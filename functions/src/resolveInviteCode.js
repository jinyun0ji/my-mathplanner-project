const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { ROLE, isViewerGroupRole } = require('./_utils/roles');

const normalizeCode = (value) => (typeof value === 'string' ? value.trim() : '');

const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    const date = expiresAt.toDate ? expiresAt.toDate() : expiresAt;
    return date instanceof Date ? date < new Date() : false;
};

const findInviteResolution = async (db, code) => {
    const inviteRef = db.collection('invites').doc(code);
    const inviteSnap = await inviteRef.get();
    if (inviteSnap.exists) {
        return { type: 'invite', ref: inviteRef, id: inviteSnap.id, data: inviteSnap.data() };
    }

    const inviteQuery = await db.collection('invites').where('code', '==', code).limit(1).get();
    if (!inviteQuery.empty) {
        const docSnap = inviteQuery.docs[0];
        return { type: 'invite', ref: docSnap.ref, id: docSnap.id, data: docSnap.data() };
    }

    const classQuery = await db.collection('classes').where('inviteCode', '==', code).limit(1).get();
    if (!classQuery.empty) {
        const classDoc = classQuery.docs[0];
        return { type: 'class', ref: classDoc.ref, id: classDoc.id, data: classDoc.data() };
    }

    return null;
};

const buildInviteResponse = (resolution) => {
    if (!resolution) {
        return { ok: false, reason: 'invalid_code' };
    }

    if (resolution.type === 'invite') {
        const inviteData = resolution.data || {};
        const role = inviteData.role;
        const studentDocId = inviteData?.target?.studentDocId
            ? String(inviteData.target.studentDocId).trim()
            : '';

        if (!isViewerGroupRole(role)) {
            return { ok: false, reason: 'role_not_allowed' };
        }

        if (inviteData.consumed) {
            return { ok: false, reason: 'consumed' };
        }

        if (isExpired(inviteData.expiresAt)) {
            return { ok: false, reason: 'expired' };
        }

        if (role === ROLE.STUDENT && !studentDocId) {
            return { ok: false, reason: 'missing_target' };
        }

        return {
            ok: true,
            source: 'invites',
            inviteId: resolution.id,
            inviteType: role === ROLE.PARENT ? 'parent' : 'student',
            role,
            studentDocId: studentDocId || null,
            presetProfile: inviteData.presetProfile || null,
            expiresAt: inviteData.expiresAt || null,
            raw: inviteData,
        };
    }

    const classData = resolution.data || {};
    return {
        ok: true,
        source: 'classes',
        inviteId: resolution.id,
        inviteType: classData.inviteType || 'student',
        classId: resolution.id,
        className: classData.name || null,
        academyId: classData.academyId || null,
        raw: classData,
    };
};

const resolveInviteCode = functions.https.onCall(async (data) => {
    const code = normalizeCode(data?.code);

    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', '초대 코드를 입력해주세요.');
    }

    const db = getFirestore();

    try {
        const resolution = await findInviteResolution(db, code);
        const response = buildInviteResponse(resolution);
        console.log('resolveInviteCode', { code, result: response.reason || response.inviteType });
        return response;
    } catch (error) {
        console.error('resolveInviteCode failed', { code, error });
        throw new functions.https.HttpsError('internal', '초대 코드 확인 중 오류가 발생했습니다.');
    }
});

module.exports = {
    resolveInviteCode,
    findInviteResolution,
    buildInviteResponse,
};