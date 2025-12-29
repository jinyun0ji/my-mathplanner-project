const functions = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ROLE } = require('./_utils/roles');
const { findInviteResolution, buildInviteResponse } = require('./resolveInviteCode');

const normalizeCode = (value) => (typeof value === 'string' ? value.trim() : '');

const acceptInviteAndCreateProfile = functions.https.onCall(async (data, context) => {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const code = normalizeCode(data?.code);
    const displayName = typeof data?.name === 'string' ? data.name.trim() : '';

    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', '초대 코드를 입력해주세요.');
    }

    const db = getFirestore();
    const resolution = buildInviteResponse(await findInviteResolution(db, code));

    if (!resolution.ok) {
        return resolution;
    }

    const uid = context.auth.uid;
    const authEmail = typeof context.auth.token?.email === 'string' ? context.auth.token.email : '';
    const authName = typeof context.auth.token?.name === 'string' ? context.auth.token.name : '';

    if (resolution.inviteType === 'student') {
        if (!resolution.studentDocId) {
            return { ok: false, reason: 'missing_target' };
        }

        const inviteRef = resolution.source === 'invites' ? db.collection('invites').doc(resolution.inviteId) : null;
        const studentRef = db.collection('students').doc(resolution.studentDocId);
        const userRef = db.collection('users').doc(uid);
        const classRef = resolution.classId ? db.collection('classes').doc(resolution.classId) : null;

        await db.runTransaction(async (tx) => {
            if (inviteRef) {
                const inviteSnap = await tx.get(inviteRef);
                const inviteState = buildInviteResponse({ type: 'invite', id: inviteSnap.id, ref: inviteRef, data: inviteSnap.data() });
                if (!inviteSnap.exists || !inviteState.ok) {
                    throw new functions.https.HttpsError('failed-precondition', '유효하지 않은 초대 코드입니다.');
                }
            }

            const studentSnap = await tx.get(studentRef);
            if (!studentSnap.exists) {
                throw new functions.https.HttpsError('not-found', '학생 정보를 찾을 수 없습니다.');
            }

            const studentData = studentSnap.data() || {};
            if (studentData.role && studentData.role !== ROLE.STUDENT) {
                throw new functions.https.HttpsError('failed-precondition', '학생 전용 초대 코드가 아닙니다.');
            }

            if (studentData.authUid && studentData.authUid !== uid) {
                throw new functions.https.HttpsError('failed-precondition', '이미 다른 계정에 연결된 학생입니다.');
            }

            const studentName = displayName
                || (typeof studentData.displayName === 'string' ? studentData.displayName.trim() : '')
                || (typeof studentData.name === 'string' ? studentData.name.trim() : '')
                || authName
                || '';

            const timestamps = {
                createdAt: studentData.createdAt || FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            const studentProfile = {
                role: ROLE.STUDENT,
                authUid: uid,
                userUid: uid,
                studentDocId: resolution.studentDocId,
                studentId: resolution.studentDocId,
                displayName: studentName,
                name: studentName,
                email: authEmail || studentData.email || '',
                active: true,
                hasAccount: true,
                inviteId: code,
                ...timestamps,
            };

            tx.set(userRef, studentProfile, { merge: true });
            tx.set(
                studentRef,
                {
                    authUid: uid,
                    userUid: uid,
                    displayName: studentName,
                    name: studentName,
                    email: authEmail || studentData.email || '',
                    inviteId: code,
                    ...timestamps,
                },
                { merge: true },
            );

            if (inviteRef) {
                tx.update(inviteRef, {
                    consumed: true,
                    consumedByAuthUid: uid,
                    consumedAt: FieldValue.serverTimestamp(),
                });
            }

            if (classRef) {
                const membershipIds = [resolution.studentDocId, uid].filter(Boolean);
                tx.set(classRef, { students: FieldValue.arrayUnion(...membershipIds) }, { merge: true });
            }
        });

        console.log('acceptInviteAndCreateProfile: student linked', { code, studentDocId: resolution.studentDocId, uid });
        return { ok: true, created: false };
    }

    if (resolution.inviteType === 'parent') {
        if (!resolution.studentDocId) {
            return { ok: false, reason: 'missing_target' };
        }

        const inviteRef = resolution.source === 'invites' ? db.collection('invites').doc(resolution.inviteId) : null;
        const parentRef = db.collection('users').doc(uid);
        const classRef = resolution.classId ? db.collection('classes').doc(resolution.classId) : null;

        let created = false;

        await db.runTransaction(async (tx) => {
            if (inviteRef) {
                const inviteSnap = await tx.get(inviteRef);
                const inviteState = buildInviteResponse({ type: 'invite', id: inviteSnap.id, ref: inviteRef, data: inviteSnap.data() });
                if (!inviteSnap.exists || !inviteState.ok) {
                    throw new functions.https.HttpsError('failed-precondition', '유효하지 않은 초대 코드입니다.');
                }
            }

            const parentSnap = await tx.get(parentRef);
            const parentData = parentSnap.exists ? parentSnap.data() || {} : {};

            if (parentData.role && parentData.role !== ROLE.PARENT) {
                throw new functions.https.HttpsError('failed-precondition', '이미 다른 역할로 가입된 계정입니다.');
            }

            const existingStudentIds = Array.isArray(parentData.studentIds)
                ? parentData.studentIds.filter(Boolean)
                : [];
            const mergedStudentIds = Array.from(new Set([...existingStudentIds, resolution.studentDocId]));
            const presetProfile = resolution.presetProfile || {};
            const finalName = presetProfile.displayName?.trim()
                || presetProfile.name?.trim()
                || authName
                || displayName;

            if (!finalName) {
                throw new functions.https.HttpsError('invalid-argument', '이름을 입력해주세요.');
            }

            const payload = {
                role: ROLE.PARENT,
                authUid: uid,
                displayName: finalName,
                email: authEmail || presetProfile.email?.trim() || '',
                active: true,
                inviteId: code,
                studentIds: mergedStudentIds,
                activeStudentId: mergedStudentIds.includes(parentData.activeStudentId)
                    ? parentData.activeStudentId
                    : mergedStudentIds[0],
                createdAt: parentData.createdAt || FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            tx.set(parentRef, payload, { merge: true });
            created = !parentSnap.exists;

            if (inviteRef) {
                tx.update(inviteRef, {
                    consumed: true,
                    consumedByAuthUid: uid,
                    consumedAt: FieldValue.serverTimestamp(),
                });
            }

            if (classRef) {
                tx.set(classRef, { students: FieldValue.arrayUnion(uid) }, { merge: true });
            }
        });

        console.log('acceptInviteAndCreateProfile: parent linked', { code, uid, studentDocId: resolution.studentDocId });
        return { ok: true, created };
    }

    return { ok: false, reason: 'unsupported_type' };
});

exports.acceptInviteAndCreateProfile = acceptInviteAndCreateProfile;