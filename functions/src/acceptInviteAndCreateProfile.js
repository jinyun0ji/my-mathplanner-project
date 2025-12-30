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

    // ✅ B안: authUid -> userDocId 인덱스 컬렉션
    const authIndexRef = db.collection('userAuthIndex').doc(uid);

    if (resolution.inviteType === 'student') {
        if (!resolution.studentDocId) {
            return { ok: false, reason: 'missing_target' };
        }

        const inviteRef = resolution.source === 'invites' ? db.collection('invites').doc(resolution.inviteId) : null;
        const studentRef = db.collection('users').doc(resolution.studentDocId);
        const classRef = resolution.classId ? db.collection('classes').doc(resolution.classId) : null;

        await db.runTransaction(async (tx) => {
            if (inviteRef) {
                const inviteSnap = await tx.get(inviteRef);
                const inviteState = buildInviteResponse({ type: 'invite', id: inviteSnap.id, ref: inviteRef, data: inviteSnap.data() });
                if (!inviteSnap.exists || !inviteState.ok) {
                    throw new functions.https.HttpsError('failed-precondition', '유효하지 않은 초대 코드입니다.');
                }
            }

            // ✅ 인덱스가 이미 다른 userDocId를 가리키고 있으면 막기
            const authIndexSnap = await tx.get(authIndexRef);
            if (authIndexSnap.exists) {
                const idx = authIndexSnap.data() || {};
                if (idx.userDocId && idx.userDocId !== resolution.studentDocId) {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        '이미 다른 사용자 프로필에 연결된 계정입니다.'
                    );
                }
                if (idx.role && idx.role !== ROLE.STUDENT) {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        '이미 다른 역할로 가입된 계정입니다.'
                    );
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

            // ✅ 이미 다른 authUid에 연결된 학생이면 막기
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

            // ✅ 1) 기존 학생 문서에 authUid만 연결 (절대 users/{uid} 새로 만들지 않음)
            tx.set(
                studentRef,
                {
                    role: ROLE.STUDENT,
                    authUid: uid,
                    userUid: uid,
                    displayName: studentName,
                    email: authEmail || studentData.email || '',
                    inviteId: code,
                    active: studentData.active ?? true,
                    ...timestamps,
                },
                { merge: true },
            );

            // ✅ 2) B안 인덱스 생성/업데이트
            tx.set(
                authIndexRef,
                {
                    role: ROLE.STUDENT,
                    userDocId: resolution.studentDocId,
                    linkedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                tx.set(classRef, { students: FieldValue.arrayUnion(resolution.studentDocId) }, { merge: true });
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
        const parentRef = db.collection('users').doc(uid); // ✅ parent는 users/{authUid} 유지 가능
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

            // ✅ parent도 index를 통해 로그인 흐름을 통일
            const authIndexSnap = await tx.get(authIndexRef);
            if (authIndexSnap.exists) {
                const idx = authIndexSnap.data() || {};
                if (idx.userDocId && idx.userDocId !== uid) {
                    throw new functions.https.HttpsError('failed-precondition', '이미 다른 사용자 프로필에 연결된 계정입니다.');
                }
                if (idx.role && idx.role !== ROLE.PARENT) {
                    throw new functions.https.HttpsError('failed-precondition', '이미 다른 역할로 가입된 계정입니다.');
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

            // ✅ parent index 생성
            tx.set(
                authIndexRef,
                {
                    role: ROLE.PARENT,
                    userDocId: uid, // parent는 users/{uid}
                    linkedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
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
                tx.set(classRef, { students: FieldValue.arrayUnion(uid) }, { merge: true });
            }
        });

        console.log('acceptInviteAndCreateProfile: parent linked', { code, uid, studentDocId: resolution.studentDocId });
        return { ok: true, created };
    }

    return { ok: false, reason: 'unsupported_type' };
});

exports.acceptInviteAndCreateProfile = acceptInviteAndCreateProfile;
