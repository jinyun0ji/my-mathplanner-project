import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';

const STAFF_TIMELINE_COLLECTION = 'staffTimeline';
const CLINIC_SOURCE_TYPE = 'clinic';

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

export const fetchPendingStaffTimeline = async (firestoreDb, limitCount = 30) => {
    if (!firestoreDb) return [];

    const timelineQuery = query(
        collection(firestoreDb, STAFF_TIMELINE_COLLECTION),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(limitCount),
    );

    const snapshot = await getDocs(timelineQuery);
    return normalizeSnapshot(snapshot);
};

export const createStaffTimelineItem = async (firestoreDb, payload) => {
    if (!firestoreDb) {
        throw new Error('Firestore가 초기화되지 않았습니다.');
    }

    const itemPayload = {
        sourceType: CLINIC_SOURCE_TYPE,
        sourceDocId: payload.sourceDocId || '',
        studentId: payload.studentId || '',
        studentName: payload.studentName || '',
        content: payload.content || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: payload.createdBy || '',
        createdByName: payload.createdByName || '',
        senderRole: payload.senderRole || '',
        completedAt: null,
        completedBy: null,
        completedByName: null,
        completionComment: '',
    };

    return addDoc(collection(firestoreDb, STAFF_TIMELINE_COLLECTION), itemPayload);
};

export const completeStaffTimelineItem = async (
    firestoreDb,
    itemId,
    { completedBy, completedByName, completionComment } = {},
) => {
    if (!firestoreDb) {
        throw new Error('Firestore가 초기화되지 않았습니다.');
    }
    if (!itemId) {
        throw new Error('인수인계 항목 ID가 없습니다.');
    }

    const itemRef = doc(firestoreDb, STAFF_TIMELINE_COLLECTION, itemId);
    return updateDoc(itemRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: completedBy || '',
        completedByName: completedByName || '',
        completionComment: completionComment || '',
    });
};

export const fetchClinicTimelineItems = async (firestoreDb, clinicLogIds = []) => {
    if (!firestoreDb) return [];

    const uniqueClinicLogIds = Array.from(new Set((clinicLogIds || []).filter(Boolean).map(String)));
    if (uniqueClinicLogIds.length === 0) return [];

    const snapshots = await Promise.all(
        chunkArray(uniqueClinicLogIds, 10).map((idChunk) => getDocs(query(
            collection(firestoreDb, STAFF_TIMELINE_COLLECTION),
            where('sourceType', '==', CLINIC_SOURCE_TYPE),
            where('sourceDocId', 'in', idChunk),
        ))),
    );

    return snapshots.flatMap(normalizeSnapshot);
};