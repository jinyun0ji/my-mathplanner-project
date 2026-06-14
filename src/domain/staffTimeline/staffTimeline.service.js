import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';

const STAFF_TIMELINE_COLLECTION = 'staffTimeline';
const REPLIES_COLLECTION = 'replies';
const CLINIC_SOURCE_TYPE = 'clinic';
const DEFAULT_DELETED_CONTENT = '삭제된 메모입니다.';

const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const normalizeSnapshot = (snapshot) => snapshot.docs.map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
}));

const visibleThreads = (items) => items.filter((item) => item?.isDeleted !== true);

const assertDb = (firestoreDb) => {
    if (!firestoreDb) throw new Error('Firestore가 초기화되지 않았습니다.');
};

const assertId = (value, message) => {
    if (!value) throw new Error(message);
};

const normalizeActor = (actor = {}) => ({
    uid: actor.uid || actor.createdBy || actor.updatedBy || actor.completedBy || '',
    name: actor.name || actor.createdByName || actor.completedByName || '',
    role: actor.role || actor.senderRole || '',
});

export const fetchStaffTimeline = async (
    firestoreDb,
    { status = 'pending', limitCount = 50 } = {},
) => {
    if (!firestoreDb) return [];

    const constraints = [];
    if (status !== 'all') constraints.push(where('status', '==', status));
    constraints.push(orderBy('createdAt', 'desc'), limit(limitCount));

    const snapshot = await getDocs(query(
        collection(firestoreDb, STAFF_TIMELINE_COLLECTION),
        ...constraints,
    ));
    return visibleThreads(normalizeSnapshot(snapshot));
};

export const fetchStaffTimelineByStudent = async (
    firestoreDb,
    studentId,
    { limitCount = 50 } = {},
) => {
    if (!firestoreDb || !studentId) return [];

    const snapshot = await getDocs(query(
        collection(firestoreDb, STAFF_TIMELINE_COLLECTION),
        where('studentId', '==', String(studentId)),
        orderBy('createdAt', 'desc'),
        limit(Math.min(limitCount, 20)),
    ));
    return visibleThreads(normalizeSnapshot(snapshot));
};

export const fetchClinicTimelineThreads = async (firestoreDb, sourceDocIds = []) => {
    if (!firestoreDb) return [];

    const uniqueSourceDocIds = Array.from(new Set((sourceDocIds || []).filter(Boolean).map(String)));
    if (uniqueSourceDocIds.length === 0) return [];

    const snapshots = await Promise.all(
        chunkArray(uniqueSourceDocIds, 10).map((idChunk) => getDocs(query(
            collection(firestoreDb, STAFF_TIMELINE_COLLECTION),
            where('sourceType', '==', CLINIC_SOURCE_TYPE),
            where('sourceDocId', 'in', idChunk),
        ))),
    );

    return visibleThreads(snapshots.flatMap(normalizeSnapshot))
        .sort((a, b) => {
            const aMillis = a?.createdAt?.toMillis?.() || 0;
            const bMillis = b?.createdAt?.toMillis?.() || 0;
            return bMillis - aMillis;
        });
};

export const createStaffTimelineThread = async (firestoreDb, payload = {}) => {
    assertDb(firestoreDb);

    const sourceSummary = payload.sourceSummary || {};
    const threadPayload = {
        sourceType: payload.sourceType || CLINIC_SOURCE_TYPE,
        sourceDocId: payload.sourceDocId || '',
        sourceCollection: payload.sourceCollection || 'clinicLogs',
        sourceSummary: {
            date: sourceSummary.date || '',
            plannedTime: sourceSummary.plannedTime || '',
            teacherName: sourceSummary.teacherName || '',
            clinicComment: sourceSummary.clinicComment || '',
            status: sourceSummary.status || '',
        },
        studentId: payload.studentId || '',
        studentName: payload.studentName || '',
        title: payload.title || '',
        content: String(payload.content || '').trim(),
        status: payload.status === 'completed' ? 'completed' : 'pending',
        createdAt: serverTimestamp(),
        createdBy: payload.createdBy || '',
        createdByName: payload.createdByName || '',
        senderRole: payload.senderRole || '',
        updatedAt: null,
        updatedBy: null,
        completedAt: null,
        completedBy: null,
        completedByName: null,
        completionComment: '',
        replyCount: 0,
        lastReplyAt: null,
        lastReplyByName: '',
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
    };

    return addDoc(collection(firestoreDb, STAFF_TIMELINE_COLLECTION), threadPayload);
};

export const updateStaffTimelineThread = async (firestoreDb, threadId, patch = {}) => {
    assertDb(firestoreDb);
    assertId(threadId, '교직원 메모 ID가 없습니다.');

    const allowedPatch = {};
    ['title', 'content'].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) allowedPatch[key] = patch[key];
    });
    allowedPatch.updatedAt = serverTimestamp();
    allowedPatch.updatedBy = patch.updatedBy || '';

    return updateDoc(doc(firestoreDb, STAFF_TIMELINE_COLLECTION, threadId), allowedPatch);
};

export const softDeleteStaffTimelineThread = async (firestoreDb, threadId, actor = {}) => {
    assertDb(firestoreDb);
    assertId(threadId, '교직원 메모 ID가 없습니다.');
    const normalizedActor = normalizeActor(actor);

    return updateDoc(doc(firestoreDb, STAFF_TIMELINE_COLLECTION, threadId), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: normalizedActor.uid,
        updatedAt: serverTimestamp(),
        updatedBy: normalizedActor.uid,
    });
};

export const completeStaffTimelineThread = async (
    firestoreDb,
    threadId,
    actor = {},
    completionComment = '',
) => {
    assertDb(firestoreDb);
    assertId(threadId, '교직원 메모 ID가 없습니다.');
    const normalizedActor = normalizeActor(actor);

    return updateDoc(doc(firestoreDb, STAFF_TIMELINE_COLLECTION, threadId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: normalizedActor.uid,
        completedByName: normalizedActor.name,
        completionComment: completionComment || '',
        updatedAt: serverTimestamp(),
        updatedBy: normalizedActor.uid,
    });
};

export const fetchStaffTimelineReplies = async (firestoreDb, threadId) => {
    if (!firestoreDb || !threadId) return [];

    const snapshot = await getDocs(query(
        collection(firestoreDb, STAFF_TIMELINE_COLLECTION, threadId, REPLIES_COLLECTION),
        orderBy('createdAt', 'asc'),
    ));
    return normalizeSnapshot(snapshot).map((reply) => (
        reply.isDeleted ? { ...reply, content: DEFAULT_DELETED_CONTENT } : reply
    ));
};

export const createStaffTimelineReply = async (firestoreDb, threadId, payload = {}) => {
    assertDb(firestoreDb);
    assertId(threadId, '교직원 메모 ID가 없습니다.');

    const threadRef = doc(firestoreDb, STAFF_TIMELINE_COLLECTION, threadId);
    const replyCollection = collection(threadRef, REPLIES_COLLECTION);
    const replyRef = doc(replyCollection);
    const content = String(payload.content || '').trim();

    return runTransaction(firestoreDb, async (transaction) => {
        const threadSnapshot = await transaction.get(threadRef);
        if (!threadSnapshot.exists()) throw new Error('교직원 메모를 찾을 수 없습니다.');

        const replyPayload = {
            content,
            createdAt: serverTimestamp(),
            createdBy: payload.createdBy || '',
            createdByName: payload.createdByName || '',
            senderRole: payload.senderRole || '',
            updatedAt: null,
            updatedBy: null,
            deletedAt: null,
            deletedBy: null,
            isDeleted: false,
        };
        const currentCount = Number(threadSnapshot.data()?.replyCount || 0);

        transaction.set(replyRef, replyPayload);
        transaction.update(threadRef, {
            replyCount: currentCount + 1,
            lastReplyAt: serverTimestamp(),
            lastReplyByName: payload.createdByName || '',
        });
        return replyRef;
    });
};

export const updateStaffTimelineReply = async (
    firestoreDb,
    threadId,
    replyId,
    patch = {},
) => {
    assertDb(firestoreDb);
    assertId(threadId, '교직원 메모 ID가 없습니다.');
    assertId(replyId, '댓글 ID가 없습니다.');

    return updateDoc(doc(
        firestoreDb,
        STAFF_TIMELINE_COLLECTION,
        threadId,
        REPLIES_COLLECTION,
        replyId,
    ), {
        content: String(patch.content || '').trim(),
        updatedAt: serverTimestamp(),
        updatedBy: patch.updatedBy || '',
    });
};

export const softDeleteStaffTimelineReply = async (
    firestoreDb,
    threadId,
    replyId,
    actor = {},
) => {
    assertDb(firestoreDb);
    assertId(threadId, '교직원 메모 ID가 없습니다.');
    assertId(replyId, '댓글 ID가 없습니다.');
    const normalizedActor = normalizeActor(actor);
    const threadRef = doc(firestoreDb, STAFF_TIMELINE_COLLECTION, threadId);
    const replyRef = doc(threadRef, REPLIES_COLLECTION, replyId);

    return runTransaction(firestoreDb, async (transaction) => {
        const [threadSnapshot, replySnapshot] = await Promise.all([
            transaction.get(threadRef),
            transaction.get(replyRef),
        ]);
        if (!replySnapshot.exists() || replySnapshot.data()?.isDeleted) return;

        transaction.update(replyRef, {
            isDeleted: true,
            content: DEFAULT_DELETED_CONTENT,
            deletedAt: serverTimestamp(),
            deletedBy: normalizedActor.uid,
            updatedAt: serverTimestamp(),
            updatedBy: normalizedActor.uid,
        });
        if (threadSnapshot.exists()) {
            const currentCount = Number(threadSnapshot.data()?.replyCount || 0);
            transaction.update(threadRef, { replyCount: Math.max(0, currentCount - 1) });
        }
    });
};

// 기존 호출부와 단계적 마이그레이션을 위한 호환 alias
export const fetchPendingStaffTimeline = (firestoreDb, limitCount = 30) => (
    fetchStaffTimeline(firestoreDb, { status: 'pending', limitCount })
);
export const createStaffTimelineItem = createStaffTimelineThread;
export const completeStaffTimelineItem = (
    firestoreDb,
    itemId,
    { completedBy, completedByName, completionComment } = {},
) => completeStaffTimelineThread(
    firestoreDb,
    itemId,
    { uid: completedBy, name: completedByName },
    completionComment,
);
export const fetchClinicTimelineItems = fetchClinicTimelineThreads;
