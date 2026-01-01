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
        const inviteState = buildInviteResponse({
          type: 'invite',
          id: inviteSnap.id,
          ref: inviteRef,
          data: inviteSnap.data(),
        });
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
            '이미 다른 사용자 프로필에 연결된 계정입니다.',
          );
        }
        if (idx.role && idx.role !== ROLE.STUDENT) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            '이미 다른 역할로 가입된 계정입니다.',
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

      const studentName =
        displayName
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
    const parentRef = db.collection('users').doc(uid); // parent는 users/{authUid}
    const classRef = resolution.classId ? db.collection('classes').doc(resolution.classId) : null;

    let created = false;

    await db.runTransaction(async (tx) => {
      if (inviteRef) {
        const inviteSnap = await tx.get(inviteRef);
        const inviteState = buildInviteResponse({
          type: 'invite',
          id: inviteSnap.id,
          ref: inviteRef,
          data: inviteSnap.data(),
        });
        if (!inviteSnap.exists || !inviteState.ok) {
          throw new functions.https.HttpsError('failed-precondition', '유효하지 않은 초대 코드입니다.');
        }
      }

      // ✅ 먼저 parent 문서부터 읽어서 parentData를 확보 (중요!)
      const parentSnap = await tx.get(parentRef);
      const parentData = parentSnap.exists ? (parentSnap.data() || {}) : {};

      // ✅ authIndex 조회 (학생 테스트 계정 -> 부모 전환을 허용)
      const authIndexSnap = await tx.get(authIndexRef);
      if (authIndexSnap.exists) {
        const idx = authIndexSnap.data() || {};
        const idxRole = idx.role || null;
        const idxUserDocId = idx.userDocId || null;

        // 1) 이미 parent로 연결되어 있고 users/{uid}를 가리키는 경우 → OK
        // 2) student로 연결되어 있었다면:
        //    - 같은 학생(studentDocId)에 대한 parent 가입이면 전환 허용
        //    - 다른 학생이면 보안상 막기
        if (idxRole === ROLE.STUDENT) {
          if (idxUserDocId && idxUserDocId !== resolution.studentDocId) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              '이미 다른 학생 프로필에 연결된 계정입니다.',
            );
          }
          console.warn('[invite] converting STUDENT -> PARENT for same auth uid', {
            uid,
            oldIdxUserDocId: idxUserDocId,
            targetStudentDocId: resolution.studentDocId,
          });
        } else if (idxRole && idxRole !== ROLE.PARENT) {
          // staff/admin 등은 전환을 막는게 안전 (원하면 여기만 완화 가능)
          throw new functions.https.HttpsError(
            'failed-precondition',
            '이미 다른 역할로 가입된 계정입니다.',
          );
        } else if (idxUserDocId && idxUserDocId !== uid && idxRole === ROLE.PARENT) {
          // parent인데 userDocId가 uid가 아닌 경우는 데이터 이상 → 막기
          throw new functions.https.HttpsError(
            'failed-precondition',
            '이미 다른 사용자 프로필에 연결된 계정입니다.',
          );
        }
      }

      // ✅ users/{uid} 문서가 이미 student였어도 parent로 전환 허용 (throw 금지)
      if (parentData.role && parentData.role !== ROLE.PARENT) {
        console.warn('[invite] overriding existing role for parent signup', {
          uid,
          oldRole: parentData.role,
        });
      }

      const existingStudentIds = Array.isArray(parentData.studentIds)
        ? parentData.studentIds.filter(Boolean)
        : [];
      const mergedStudentIds = Array.from(new Set([...existingStudentIds, resolution.studentDocId]));

      const presetProfile = resolution.presetProfile || {};
      const finalName =
        presetProfile.displayName?.trim()
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

      // ✅ parent index 생성/덮어쓰기 (student였어도 parent로 전환)
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
        // parent도 class.students에 uid 넣을지 여부는 기존 정책 유지
        tx.set(classRef, { students: FieldValue.arrayUnion(uid) }, { merge: true });
      }
    });

    console.log('acceptInviteAndCreateProfile: parent linked', { code, uid, studentDocId: resolution.studentDocId });
    return { ok: true, created };
  }

  return { ok: false, reason: 'unsupported_type' };
});

exports.acceptInviteAndCreateProfile = acceptInviteAndCreateProfile;