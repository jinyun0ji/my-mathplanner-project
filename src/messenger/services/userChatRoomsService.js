import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase/client';
import { getLastMessagePreview } from './roomPreviewService';
import { isLegacySlotRoomTypeMatch, normalizeText } from '../utils/roomMatcher';

export const getUserChatRoomsQueryShape = (authUid) => ({ collection: `userChatRooms/${authUid}/rooms` });

const uniqueStrings = (values) => Array.from(new Set(
    values.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
));

const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

export const sortUserRoomIndexes = (indexes = []) => [...indexes].sort((left, right) => toMillis(right.lastMessageAt || right.updatedAt) - toMillis(left.lastMessageAt || left.updatedAt));

export const sortRoomsByActivity = (rooms = []) => [...rooms].sort((left, right) => toMillis(right.lastMessageAt || right.updatedAt || right.createdAt) - toMillis(left.lastMessageAt || left.updatedAt || left.createdAt));

export const mergeRoomWithIndex = (room, index) => ({
    ...(room || {}),
    id: room?.id || index?.roomId || index?.id || '',
    roomId: room?.roomId || index?.roomId || index?.id || '',
    indexLastMessageText: index?.lastMessageText || '',
    indexLastMessageAt: index?.lastMessageAt || null,
    indexUpdatedAt: index?.updatedAt || null,
    lastMessageText: index?.lastMessageText || room?.lastMessageText || '',
    lastMessageAt: index?.lastMessageAt || room?.lastMessageAt || null,
    lastSenderId: index?.lastSenderId || room?.lastSenderId || room?.lastMessageSenderId || '',
    updatedAt: index?.updatedAt || room?.updatedAt || null,
    __source: index ? 'userChatRooms' : 'chatRooms_fallback',
});

const getUserProfileForAuthUid = async (authUid) => {
    const currentAuthUid = String(authUid || '').trim();
    if (!currentAuthUid) return { authUid: '', userDocId: '', profile: {} };
    const indexSnap = await getDoc(doc(db, 'userAuthIndex', currentAuthUid));
    const userDocId = indexSnap.exists() ? String(indexSnap.data()?.userDocId || '').trim() : '';
    if (!userDocId) return { authUid: currentAuthUid, userDocId: '', profile: {} };
    const userSnap = await getDoc(doc(db, 'users', userDocId));
    return { authUid: currentAuthUid, userDocId, profile: userSnap.exists() ? userSnap.data() || {} : {} };
};

const collectRoom = (map, docSnap) => map.set(docSnap.id, { id: docSnap.id, __source: 'chatRooms_fallback', ...docSnap.data() });

const readMessagePreview = (message = {}) => normalizeText(message?.text) || normalizeText(message?.content) || normalizeText(message?.body) || (Array.isArray(message?.attachments) && message.attachments.length ? '첨부파일' : '');

const hasRoomPreview = (room) => Boolean(room && getLastMessagePreview(room) !== '대화 내역이 없습니다.');

const enrichRoomWithLatestMessagePreview = async (room) => {
    if (!room?.id || hasRoomPreview(room)) return room;
    try {
        const latestSnap = await getDocs(query(collection(db, 'chatRooms', room.id, 'messages'), orderBy('createdAt', 'desc'), limit(1)));
        const latestDoc = latestSnap.docs[0];
        if (!latestDoc) return room;
        const message = latestDoc.data() || {};
        return {
            ...room,
            __previewText: readMessagePreview(message),
            __previewAt: message.createdAt || message.updatedAt || null,
        };
    } catch (error) {
        if (process.env.NODE_ENV === 'development') console.warn('[mobile messenger room preview debug] latest message preview query failed', { roomId: room.id, code: error?.code, message: error?.message });
        return room;
    }
};

const enrichRoomsWithLatestMessagePreviews = async (rooms = []) => Promise.all(rooms.map(enrichRoomWithLatestMessagePreview));

const logMobileRoomPreviewDebug = ({ role, authUid, rooms = [], source, indexes = [] }) => {
    if (process.env.NODE_ENV !== 'development') return;
    const indexSourceByRoomId = new Map(indexes.map((index) => [String(index?.roomId || index?.id || ''), 'userChatRooms']));
    rooms.forEach((room) => {
        console.log('[mobile messenger room preview debug]', {
            role,
            authUid,
            roomId: room?.id || room?.roomId || '',
            title: room?.title || room?.name || room?.roomName || room?.displayName || '',
            keys: Object.keys(room || {}),
            lastMessageText: room?.lastMessageText,
            lastMessage: room?.lastMessage,
            lastMessageAt: room?.lastMessageAt,
            previewText: room?.previewText,
            latestMessageText: room?.latestMessageText,
            lastMessagePreview: room?.lastMessagePreview,
            source: room?.source || room?.__source || indexSourceByRoomId.get(String(room?.id || room?.roomId || '')) || source,
            dataPathSource: (room?.__source || source) === 'userChatRooms' ? 'userChatRooms' : 'chatRooms fallback',
            __previewText: room?.__previewText,
            __previewAt: room?.__previewAt,
        });
    });
};


export const fetchStudentFallbackRooms = async (authUid) => {
    const { authUid: currentAuthUid, userDocId, profile } = await getUserProfileForAuthUid(authUid);
    if (!currentAuthUid || !userDocId) return [];
    const candidateKeys = uniqueStrings([currentAuthUid, userDocId, profile.authUid, profile.userUid, profile.uid, profile.parentUid, profile.studentAuthUid, profile.studentId]);
    const roomsById = new Map();
    const snap = await getDocs(query(collection(db, 'chatRooms'), where('studentId', '==', userDocId)));
    snap.docs.forEach((roomDoc) => collectRoom(roomsById, roomDoc));
    return sortRoomsByActivity(Array.from(roomsById.values()).filter((room) => {
        const isStudentRoom = ['student_institute', 'student_teacher'].some((expectedType) => isLegacySlotRoomTypeMatch(room, expectedType));
        const hasStudentIdentity = String(room?.studentId || '') === userDocId
            || String(room?.studentUid || '') === currentAuthUid
            || String(room?.studentAuthUid || '') === currentAuthUid
            || (Array.isArray(room?.participantIds) && candidateKeys.some((key) => room.participantIds.map(String).includes(key)));
        const hasExpectedCounterpart = Boolean(room?.staffAuthUid || room?.teacherAuthUid || room?.counterpartUid || (Array.isArray(room?.participantIds) && room.participantIds.length > 1));
        return isStudentRoom && hasStudentIdentity && hasExpectedCounterpart;
    }));
};

export const fetchParentFallbackRooms = async (authUid) => {
    const { authUid: currentAuthUid, userDocId: parentDocId, profile } = await getUserProfileForAuthUid(authUid);
    if (!currentAuthUid || !parentDocId) return [];
    const studentIds = Array.isArray(profile.studentIds) ? profile.studentIds.map(String).filter(Boolean).slice(0, 10) : [];
    const candidateKeys = uniqueStrings([currentAuthUid, parentDocId, profile.authUid, profile.userUid, profile.uid, profile.parentUid, profile.studentAuthUid]);
    const roomsById = new Map();
    const parentSnap = await getDocs(query(collection(db, 'chatRooms'), where('parentId', '==', parentDocId)));
    parentSnap.docs.forEach((roomDoc) => collectRoom(roomsById, roomDoc));
    if (studentIds.length > 0) {
        const studentSnap = await getDocs(query(collection(db, 'chatRooms'), where('studentId', 'in', studentIds)));
        studentSnap.docs.forEach((roomDoc) => collectRoom(roomsById, roomDoc));
    }
    return sortRoomsByActivity(Array.from(roomsById.values()).filter((room) => {
        const isParentRoom = ['parent_institute', 'parent_teacher'].some((expectedType) => isLegacySlotRoomTypeMatch(room, expectedType));
        const roomParticipantIds = Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [];
        const hasParentIdentity = String(room?.parentId || '') === parentDocId
            || candidateKeys.includes(String(room?.parentUid || ''))
            || candidateKeys.some((key) => roomParticipantIds.includes(key))
            || (studentIds.length > 0 && studentIds.includes(String(room?.studentId || '')));
        return isParentRoom && hasParentIdentity;
    }));
};

export const fetchRoomsForIndexes = async (indexes = []) => {
    const rooms = await Promise.all(sortUserRoomIndexes(indexes).map(async (index) => {
        const roomId = String(index?.roomId || index?.id || '').trim();
        if (!roomId) return null;
        const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
        if (!roomSnap.exists()) return mergeRoomWithIndex({ id: roomId }, index);
        return mergeRoomWithIndex({ id: roomSnap.id, ...roomSnap.data() }, index);
    }));
    return rooms.filter(Boolean);
};

export const subscribeUserChatRooms = ({ authUid, role = '', onNext, onError }) => {
    const indexQuery = query(collection(db, 'userChatRooms', authUid, 'rooms'));
    return onSnapshot(indexQuery, async (snap) => {
        try {
            if (process.env.NODE_ENV === 'development') {
                console.log('[resolver] userChatRooms snapshot', { role, authUid, count: snap.docs.length, ids: snap.docs.map((docSnap) => docSnap.id) });
            }
            const indexes = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            const indexedRooms = await enrichRoomsWithLatestMessagePreviews(await fetchRoomsForIndexes(indexes));
            if (role === 'staff' || indexedRooms.length > 0) {
                if (process.env.NODE_ENV === 'development') {
                    console.log('[resolver] room list count', { role, authUid, count: indexedRooms.length });
                    console.log('[resolver] rooms missing lastMessageText count', { role, authUid, count: indexedRooms.filter((room) => !room?.lastMessageText).length });
                }
                logMobileRoomPreviewDebug({ role, authUid, rooms: indexedRooms, source: 'userChatRooms', indexes });
                onNext(indexedRooms, indexes);
                return;
            }
            if (process.env.NODE_ENV === 'development') {
                console.log('[resolver] userChatRooms empty; using chatRooms fallback', { role, authUid });
            }
            const fallbackRooms = role === 'parent' ? await fetchParentFallbackRooms(authUid) : await fetchStudentFallbackRooms(authUid);
            const sortedFallbackRooms = sortRoomsByActivity(await enrichRoomsWithLatestMessagePreviews(fallbackRooms));
            if (process.env.NODE_ENV === 'development') {
                console.log('[resolver] room list count', { role, authUid, count: sortedFallbackRooms.length });
                console.log('[resolver] rooms missing lastMessageText count', { role, authUid, count: sortedFallbackRooms.filter((room) => !room?.lastMessageText).length });
            }
            logMobileRoomPreviewDebug({ role, authUid, rooms: sortedFallbackRooms, source: 'chatRooms_fallback', indexes });
            onNext(sortedFallbackRooms, indexes);
        } catch (error) {
            onError?.(error);
        }
    }, onError);
};
