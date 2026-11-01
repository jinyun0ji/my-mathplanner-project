const { createHash } = require('node:crypto');
const { Timestamp } = require('firebase-admin/firestore');
const functions = require('firebase-functions');

const SOURCES = ['clinicReservations', 'clinicLogs'];
const ACTIVE = new Set(['pending', 'reserved', 'booked', 'scheduled', '예약', '예약됨', '입실 예정']);
const FINISHED = new Set(['attended', 'completed', 'complete', 'done', 'present', '참석', '완료', '참석 완료',
    'no-show', 'no_show', 'noshow', 'missed', 'absent', '미참석',
    'cancelled', 'canceled', 'cancel', '취소', '예약취소', '예약 취소']);
const clean = (value) => typeof value === 'string' ? value.trim() : '';
const studentKey = (data) => clean(data.studentDocId) || clean(data.studentId) || clean(data.authUid) || clean(data.studentUid);
const plannedTime = (data) => clean(data.plannedTime) || clean(data.timeSlot) || clean(data.time) || clean(data.slot);
const error = (code, message) => new functions.https.HttpsError(code, message);
const hasActivityOrCancellation = (data) => Boolean(data.checkIn || data.checkOut || data.isDeleted || data.deletedAt
    || data.cancelledAt || data.canceledAt || data.cancelled || data.canceled || data.noShow)
    || ['status', 'attendanceStatus', 'clinicStatus', 'result', 'checkStatus']
        .some((key) => FINISHED.has(String(data[key] || '').trim().toLowerCase()));
const isPendingReservation = (data) => !hasActivityOrCancellation(data) && Boolean(plannedTime(data))
    && (!clean(data.status) || ACTIVE.has(clean(data.status).toLowerCase()));

function parseKoreanReservationTime(date, time) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw error('invalid-argument', '날짜는 YYYY-MM-DD, 예약 시간은 HH:mm 형식이어야 합니다.');
    }
    const midnight = Date.parse(`${date}T00:00:00+09:00`);
    if (!Number.isFinite(midnight) || Number(date.slice(0, 4)) < 1
        || new Date(midnight + 9 * 3600000).toISOString().slice(0, 10) !== date) {
        throw error('invalid-argument', '유효하지 않은 한국 날짜입니다.');
    }
    try {
        return {
            reservationStartsAt: Timestamp.fromMillis(Date.parse(`${date}T${time}:00+09:00`)),
            // D-1 18:00 KST, NOT 24 hours before the appointment.
            reminderDueAt: Timestamp.fromMillis(midnight - 6 * 3600000),
        };
    } catch (_) {
        throw error('invalid-argument', 'Firestore Timestamp 범위 밖의 날짜입니다.');
    }
}

async function studentReservationKeys({ db, resolveIdentity, key }) {
    let identity = await resolveIdentity(key);
    // Some legacy profiles have only reverse index links, without an authUid field.
    if (!identity && key) {
        const links = await db.collection('userAuthIndex').where('userDocId', '==', key).get();
        for (const link of links.docs) {
            const linked = await resolveIdentity(link.id);
            if (linked?.studentDocId === key) { identity = linked; break; }
        }
    }
    if (!identity && key) {
        const profile = await db.collection('users').doc(key).get();
        // Editing a booking needs a student profile, not an Auth recipient.
        // Keep unlinked legacy students usable without inventing an Auth UID.
        if (profile.exists && profile.data().role === 'student') {
            identity = { role: 'student', studentDocId: profile.id, authUid: null };
        }
    }
    if (!identity || identity.role !== 'student' || !identity.studentDocId) {
        throw error('failed-precondition', '예약의 학생 프로필을 확인할 수 없습니다.');
    }
    const keys = new Set([key, identity.studentDocId, identity.authUid].filter(Boolean));
    const profile = await db.collection('users').doc(identity.studentDocId).get();
    if (profile.exists) {
        for (const field of ['authUid', 'uid', 'userUid', 'studentUid', 'studentAuthUid']) {
            const alias = clean(profile.data()[field]);
            if (alias) keys.add(alias);
        }
    }
    // Review/demo Auth aliases can point at the same existing student profile.
    const aliases = await db.collection('userAuthIndex').where('userDocId', '==', identity.studentDocId).get();
    aliases.docs.forEach((doc) => keys.add(doc.id));
    return { studentDocId: identity.studentDocId, keys };
}

async function checkReservationDate(tx, db, student, date, excludePath = '') {
    const lockId = createHash('sha256').update(JSON.stringify([student.studentDocId, date])).digest('hex');
    const lockRef = db.collection('_clinicReservationDateLocks').doc(lockId);
    const lock = await tx.get(lockRef);
    // Date-only queries use the built-in index and cover legacy student aliases
    // in both collections. Fail closed instead of silently truncating a day.
    const days = await Promise.all(SOURCES.map((source) => tx.get(db.collection(source).where('date', '==', date).limit(501))));
    for (const day of days) {
        if (day.docs.length > 500) throw error('resource-exhausted', '해당 날짜의 예약 조회 한도를 초과했습니다.');
        for (const doc of day.docs) {
            if (doc.ref.path === excludePath) continue;
            const data = doc.data();
            const sameStudent = ['studentDocId', 'studentId', 'authUid', 'studentUid'].some((field) => student.keys.has(clean(data[field])));
            if (sameStudent && isPendingReservation(data)) throw error('already-exists', '해당 학생의 같은 날짜 예약이 이미 있습니다.');
        }
    }
    return { lockRef, lockVersion: lock.exists ? (lock.data().version || 0) : 0 };
}

function writeReservationDateLock(tx, lock, student, date, at) {
    tx.set(lock.lockRef, { studentDocId: student.studentDocId, date, version: lock.lockVersion + 1, updatedAt: at });
}

module.exports = { SOURCES, clean, studentKey, plannedTime, isPendingReservation, parseKoreanReservationTime,
    studentReservationKeys, checkReservationDate, writeReservationDateLock, error };
