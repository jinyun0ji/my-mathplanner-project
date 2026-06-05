import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    collection,
    addDoc,
    arrayUnion,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/client';

const CANDIDATE_ROOM_IDS = (studentId) => [String(studentId || '')].filter(Boolean);

const CHAT_ROOM_TYPES = {
    student: {
        institute: 'student_institute',
        teacher: 'student_teacher',
    },
    parent: {
        institute: 'parent_institute',
        teacher: 'parent_teacher',
    },
};

const getExpectedRoomType = (role, slotOrType) => {
    const normalizedRole = String(role || '').trim();
    const normalized = String(slotOrType || '').trim();
    if (normalizedRole === 'parent' && (normalized === 'institute' || normalized === 'parent_institute')) return 'parent_institute';
    if (['student_institute', 'student_teacher', 'parent_institute', 'parent_teacher'].includes(normalized)) return normalized;
    return CHAT_ROOM_TYPES[normalizedRole]?.[normalized] || '';
};

const getRoomType = (room) => String(room?.roomType || room?.channel || '').trim();
const hasRoomTypeOrChannel = (room, expectedRoomType) => (
    String(room?.roomType || '').trim() === expectedRoomType
    || String(room?.channel || '').trim() === expectedRoomType
);

const getRoomSlot = (room) => {
    const explicitSlot = String(room?.slot || '').trim();
    if (explicitSlot) return explicitSlot;
    const type = getRoomType(room);
    if (type === 'institute' || type.endsWith('_institute')) return 'institute';
    if (type === 'teacher' || type.endsWith('_teacher')) return 'teacher';
    return '';
};

const isCompatibleRoomType = (room, expectedRoomType) => {
    const actualType = getRoomType(room);
    if (expectedRoomType === 'parent_institute') return hasRoomTypeOrChannel(room, 'parent_institute');
    if (actualType === expectedRoomType) return true;
    if (actualType === 'institute') return expectedRoomType === 'student_institute';
    if (actualType === 'teacher') return expectedRoomType === 'student_teacher' || expectedRoomType === 'parent_teacher';
    return false;
};

const buildStandardRoomId = (roomType, ownerUid, counterpartUid, studentId = '') => {
    if (!roomType || !ownerUid || !counterpartUid) return '';
    if (roomType === 'parent_institute') {
        const normalizedStudentId = String(studentId || '').trim();
        if (!normalizedStudentId) return '';
        return `direct_parent_institute_${ownerUid}_${counterpartUid}_${normalizedStudentId}`;
    }
    return `direct_${roomType}_${ownerUid}_${counterpartUid}`;
};

const isExactStandardRoom = (room, { viewerUid, targetAuthUid, roomType, studentId = '' }) => {
    if (!room || !viewerUid || !targetAuthUid || !roomType) return false;
    if (!isCompatibleRoomType(room, roomType)) return false;
    const expectedSlot = roomType.endsWith('_teacher') ? 'teacher' : 'institute';
    const roomSlot = getRoomSlot(room);
    if (roomSlot && roomSlot !== expectedSlot) return false;
    const participantIds = Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [];
    if (participantIds.length !== 2) return false;
    if (!participantIds.includes(String(viewerUid)) || !participantIds.includes(String(targetAuthUid))) return false;
    if (roomType === 'parent_institute') {
        if (!hasRoomTypeOrChannel(room, 'parent_institute')) return false;
        if (!studentId || String(room?.studentId || '') !== String(studentId)) return false;
        if (String(room?.counterpartUid || '') !== String(targetAuthUid) && String(room?.staffAuthUid || '') !== String(targetAuthUid)) return false;
    }
    if (room?.targetRole && expectedSlot === 'teacher' && String(room.targetRole) !== 'teacher') return false;
    if (room?.targetRole && expectedSlot === 'institute' && String(room.targetRole) !== 'staff') return false;
    if (roomType !== 'parent_institute' && room?.counterpartUid && String(room.counterpartUid) !== String(targetAuthUid)) return false;
    if (expectedSlot === 'teacher' && room?.teacherAuthUid && String(room.teacherAuthUid) !== String(targetAuthUid)) return false;
    if ((roomType === 'parent_teacher' || roomType === 'parent_institute') && studentId && room?.studentId && String(room.studentId) !== String(studentId)) return false;
    return true;
};

const resolveStandardChatRoom = async ({ viewerUid, targetAuthUid, roomType, studentId = '' }) => {
    if (!viewerUid || !targetAuthUid || !roomType) return null;
    const deterministicRoomId = buildStandardRoomId(roomType, viewerUid, targetAuthUid, studentId);
    if (deterministicRoomId) {
        try {
            const directSnap = await getDoc(doc(db, 'chatRooms', deterministicRoomId));
            if (directSnap.exists()) {
                const room = { id: directSnap.id, ...directSnap.data() };
                if (isExactStandardRoom(room, { viewerUid, targetAuthUid, roomType, studentId })) return room;
            }
        } catch (error) {
            logFirestoreQueryFailure('resolve standard direct room doc', error, { doc: ['chatRooms', deterministicRoomId] });
        }
    }

    try {
        const snap = await getDocs(query(collection(db, 'chatRooms'), where('participantIds', 'array-contains', String(viewerUid))));
        const room = snap.docs
            .map((roomDoc) => ({ id: roomDoc.id, ...roomDoc.data() }))
            .find((candidate) => isExactStandardRoom(candidate, { viewerUid, targetAuthUid, roomType, studentId }));
        if (room) return room;
    } catch (error) {
        logFirestoreQueryFailure('resolve standard participant rooms', error, { collection: 'chatRooms', where: ['participantIds', 'array-contains', String(viewerUid)] });
    }

    return null;
};

const parseClientTempIdTime = (clientTempId) => {
    const match = String(clientTempId || '').match(/(\d{12,})/);
    if (!match) return 0;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getCreatedAtTime = (createdAt) => {
    if (createdAt && typeof createdAt?.toDate === 'function') {
        const time = createdAt.toDate().getTime();
        if (Number.isFinite(time)) return time;
    }
    if (createdAt instanceof Date) {
        const time = createdAt.getTime();
        if (Number.isFinite(time)) return time;
    }
    if (typeof createdAt === 'number' && Number.isFinite(createdAt)) return createdAt;
    return 0;
};

const getMessageSortTime = (message) => {
    const createdAtTime = getCreatedAtTime(message?.createdAt);
    if (createdAtTime) return createdAtTime;

    const localCreatedAtMs = Number(message?.localCreatedAtMs || 0);
    if (Number.isFinite(localCreatedAtMs) && localCreatedAtMs > 0) return localCreatedAtMs;

    const clientTempIdTime = parseClientTempIdTime(message?.clientTempId || message?.id);
    return clientTempIdTime || Date.now();
};

const getMessageCreatedAtDate = (message) => new Date(getMessageSortTime(message));

const isSameLogicalMessage = (left, right) => {
    if (!left || !right) return false;
    if (left.clientTempId && right.clientTempId && left.clientTempId === right.clientTempId) return true;

    const canUseFuzzyMatch = Boolean(left.clientTempId || right.clientTempId || left.pending || right.pending);
    if (!canUseFuzzyMatch) return false;

    const leftText = String(left.text || left.message || '').trim();
    const rightText = String(right.text || right.message || '').trim();
    if (!leftText || leftText !== rightText) return false;
    if (String(left.senderId || '') !== String(right.senderId || '')) return false;

    return Math.abs(getMessageSortTime(left) - getMessageSortTime(right)) <= 15_000;
};

const dedupeMessages = (items) => items.reduce((acc, item) => {
    const existingIndex = acc.findIndex((candidate) => isSameLogicalMessage(candidate.raw, item.raw));
    if (existingIndex === -1) return [...acc, item];

    const existing = acc[existingIndex];
    const existingPending = Boolean(existing.raw?.pending);
    const itemPending = Boolean(item.raw?.pending);
    if (existingPending && !itemPending) {
        const next = [...acc];
        next[existingIndex] = item;
        return next;
    }
    return acc;
}, []);

const sortMessageItems = (items) => [...items].sort((a, b) => getMessageSortTime(a.raw) - getMessageSortTime(b.raw));

const buildSenderName = () => (
    auth.currentUser?.displayName
    || auth.currentUser?.email
    || '학부모'
);

const logFirestoreQueryFailure = (context, error, queryShape) => {
    console.error(`[student messenger] ${context} failed`, {
        code: error?.code,
        message: error?.message,
        query: queryShape,
        error,
    });
};

const formatDateKey = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'unknown-date';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateDivider = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '날짜 정보 없음';
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
    }).format(date);
};

const formatMessageTime = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const normalizeMessage = (id, data, myIds, fallbackSenderName = '메시지') => {
    const createdAtDate = getMessageCreatedAtDate(data);
    const senderId = String(data?.senderId || '');
    const senderRole = String(data?.senderRole || 'staff');
    const isMe = senderId ? myIds.has(senderId) : false;
    return {
        id,
        text: data?.text || data?.message || '',
        isMe,
        senderId,
        senderRole,
        senderName: isMe ? '나' : (data?.senderName || fallbackSenderName || '메시지'),
        createdAt: createdAtDate,
        date: formatDateKey(createdAtDate),
        dateLabel: formatDateDivider(createdAtDate),
        time: formatMessageTime(createdAtDate),
        clientTempId: data?.clientTempId || '',
        localCreatedAtMs: data?.localCreatedAtMs || null,
        pending: Boolean(data?.pending),
    };
};

async function resolveRoomId(studentId, studentAuthUid = '') {
    const sid = String(studentId || '');
    const suid = String(studentAuthUid || '');
    if (!sid && !suid) return null;

    const chatsRef = collection(db, 'chats');

    const checks = [
        {
            label: 'chats by studentId',
            shape: { collection: 'chats', where: ['studentId', '==', sid], limit: 1 },
            run: async () => {
                if (!sid) return null;
                const snap = await getDocs(query(chatsRef, where('studentId', '==', sid), limit(1)));
                return snap.empty ? null : snap.docs[0].id;
            },
        },
        {
            label: 'chats by participants',
            shape: { collection: 'chats', where: ['participants', 'array-contains', suid], limit: 1 },
            run: async () => {
                if (!suid) return null;
                const snap = await getDocs(query(chatsRef, where('participants', 'array-contains', suid), limit(1)));
                return snap.empty ? null : snap.docs[0].id;
            },
        },
        {
            label: 'chats by participantIds',
            shape: { collection: 'chats', where: ['participantIds', 'array-contains', suid], limit: 1 },
            run: async () => {
                if (!suid) return null;
                const snap = await getDocs(query(chatsRef, where('participantIds', 'array-contains', suid), limit(1)));
                return snap.empty ? null : snap.docs[0].id;
            },
        },
        {
            label: 'direct chat document',
            shape: { doc: ['chats', sid] },
            run: async () => {
                if (!sid) return null;
                const direct = await getDoc(doc(db, 'chats', sid));
                return direct.exists() ? sid : null;
            },
        },
    ];

    for (const check of checks) {
        try {
            console.log('[student messenger] resolve room query', check.shape);
            const roomId = await check.run();
            if (roomId) return roomId;
        } catch (error) {
            logFirestoreQueryFailure(check.label, error, check.shape);
        }
    }

    return null;
}

export default function StudentMessenger({ studentId, studentAuthUid = '', selectedRoomId = '', teacherName = '메시지', userRole = 'parent', isFloating = false, allowLegacyResolve = true, emptyMessage = '아직 대화 내역이 없습니다.', chatSlot = '', roomCreationContext = null }) {
    const [roomId, setRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [optimisticMessages, setOptimisticMessages] = useState([]);
    const optimisticMessagesRef = useRef([]);
    const [inputText, setInputText] = useState('');
    const [error, setError] = useState('');
    const [myProfileDocId, setMyProfileDocId] = useState('');
    const messagesEndRef = useRef(null);
    const normalizedChatSlot = String(chatSlot || roomCreationContext?.slot || '');
    const expectedRoomType = userRole === 'parent' && normalizedChatSlot === 'institute'
        ? 'parent_institute'
        : getExpectedRoomType(userRole, roomCreationContext?.roomType || normalizedChatSlot);
    const canCreateChatRoom = Boolean(roomCreationContext?.targetAuthUid && expectedRoomType);

    useEffect(() => {
        optimisticMessagesRef.current = optimisticMessages;
    }, [optimisticMessages]);

    useEffect(() => {
        const authUid = auth.currentUser?.uid || '';
        if (!authUid) {
            setMyProfileDocId('');
            return undefined;
        }

        let mounted = true;
        getDoc(doc(db, 'userAuthIndex', authUid)).then((indexSnap) => {
            if (!mounted) return;
            setMyProfileDocId(indexSnap.exists() ? String(indexSnap.data()?.userDocId || '') : '');
        }).catch((indexError) => {
            logFirestoreQueryFailure('load userAuthIndex', indexError, { doc: ['userAuthIndex', authUid] });
            if (mounted) setMyProfileDocId('');
        });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (selectedRoomId) {
            setMessages([]);
            setOptimisticMessages([]);
            setRoomId(String(selectedRoomId));
            return undefined;
        }

        let mounted = true;
        setRoomId(null);
        setMessages([]);
        setOptimisticMessages([]);
        setError('');

        const viewerUid = auth.currentUser?.uid || '';
        const targetAuthUid = String(roomCreationContext?.targetAuthUid || '');
        if (canCreateChatRoom && viewerUid && targetAuthUid && expectedRoomType) {
            resolveStandardChatRoom({ viewerUid, targetAuthUid, roomType: expectedRoomType, studentId }).then((resolvedRoom) => {
                if (!mounted) return;
                if (resolvedRoom) {
                    console.log('[messenger] resolved room', {
                        roomId: resolvedRoom.id,
                        roomType: getRoomType(resolvedRoom),
                        participantIds: resolvedRoom.participantIds || [],
                    });
                    if (userRole === 'parent' && normalizedChatSlot === 'institute') {
                        console.log('[parent messenger] selected institute room', {
                            roomId: resolvedRoom.id,
                            roomType: resolvedRoom.roomType,
                            channel: resolvedRoom.channel,
                            participantIds: resolvedRoom.participantIds || [],
                            parentUid: resolvedRoom.parentUid,
                            studentId: resolvedRoom.studentId,
                        });
                    }
                    setRoomId(resolvedRoom.id);
                }
            }).catch((resolveError) => {
                logFirestoreQueryFailure('resolve standard room', resolveError, {
                    viewerUid,
                    targetAuthUid,
                    roomType: expectedRoomType,
                    studentId: String(studentId || ''),
                });
                if (mounted) setError('대화방을 찾는 중 권한 오류가 발생했습니다. 관리자에게 문의해주세요.');
            });
            return () => {
                mounted = false;
            };
        }

        if (!allowLegacyResolve) {
            return () => {
                mounted = false;
            };
        }

        resolveRoomId(studentId, studentAuthUid).then((resolved) => {
            if (mounted) setRoomId(resolved);
        }).catch((resolveError) => {
            logFirestoreQueryFailure('resolve room', resolveError, {
                studentId: String(studentId || ''),
                studentAuthUid: String(studentAuthUid || ''),
            });
            if (mounted) setError('대화방을 찾는 중 권한 오류가 발생했습니다. 관리자에게 문의해주세요.');
        });

        return () => {
            mounted = false;
        };
    }, [studentId, studentAuthUid, selectedRoomId, allowLegacyResolve, canCreateChatRoom, expectedRoomType, roomCreationContext?.targetAuthUid, normalizedChatSlot, userRole]);

    useEffect(() => {
        if (!roomId) return undefined;
        
        const isChatRoomMode = Boolean(selectedRoomId || canCreateChatRoom);
        const collectionPath = isChatRoomMode ? `chatRooms/${roomId}/messages` : `chats/${roomId}/messages`;
        const collectionArgs = isChatRoomMode ? ['chatRooms', roomId, 'messages'] : ['chats', roomId, 'messages'];
        let fallbackUnsub = null;

        const applySnapshot = (snap) => {
            const myIds = new Set([auth.currentUser?.uid, myProfileDocId].filter(Boolean).map(String));
            const fallbackSenderName = teacherName || '메시지';
            setError('');
            const snapshotItems = snap.docs.map((item) => ({
                id: item.id,
                raw: {
                    ...item.data(),
                    pending: item.metadata?.hasPendingWrites || Boolean(item.data()?.pending),
                },
            }));
            const unresolvedOptimisticItems = optimisticMessagesRef.current
                .filter((item) => String(item.roomId || '') === String(roomId))
                .filter((optimistic) => !snapshotItems.some((serverItem) => isSameLogicalMessage(serverItem.raw, optimistic)))
                .map((item) => ({ id: item.id, raw: item }));
            const mergedItems = sortMessageItems(dedupeMessages([...snapshotItems, ...unresolvedOptimisticItems]));

            setOptimisticMessages((prev) => {
                const next = prev.filter((optimistic) => (
                    String(optimistic.roomId || '') !== String(roomId)
                    || !snapshotItems.some((serverItem) => isSameLogicalMessage(serverItem.raw, optimistic))
                ));
                if (next.length === prev.length) return prev;
                optimisticMessagesRef.current = next;
                return next;
            });
            setMessages(mergedItems
                .map((item) => normalizeMessage(item.id, item.raw, myIds, fallbackSenderName))
                .filter((item) => item.text));
        };

        const subscribe = (withOrderBy) => {
            const queryShape = withOrderBy
                ? { collection: collectionPath, orderBy: ['createdAt', 'asc'] }
                : { collection: collectionPath, orderBy: null, clientSort: ['createdAt', 'asc'] };
            console.log('[student messenger] subscribe messages query', queryShape);
            const messagesRef = collection(db, ...collectionArgs);
            const messagesQuery = withOrderBy ? query(messagesRef, orderBy('createdAt', 'asc')) : query(messagesRef);

            return onSnapshot(messagesQuery, applySnapshot, (snapshotError) => {
                logFirestoreQueryFailure('subscribe messages', snapshotError, queryShape);
                if (withOrderBy) {
                    fallbackUnsub = subscribe(false);
                    return;
                }
                setError('메시지를 불러올 권한이 없습니다. 관리자에게 문의해주세요.');
            });
        };

        const unsub = subscribe(true);
        return () => {
            unsub && unsub();
            fallbackUnsub && fallbackUnsub();
        };
    }, [roomId, selectedRoomId, canCreateChatRoom, myProfileDocId, teacherName]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const placeholder = useMemo(() => (userRole === 'parent' ? '메시지 보내기...' : '메시지 입력'), [userRole]);

    const handleSend = async (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text) return;

        const viewerUid = auth.currentUser?.uid || 'parent-anonymous';
        const targetAuthUidForRoom = String(roomCreationContext?.targetAuthUid || '');
        const isChatRoomMode = Boolean(selectedRoomId || canCreateChatRoom);
        let resolvedRoomId = selectedRoomId ? String(selectedRoomId) : roomId || null;
        let shouldCreateStandardRoom = false;
        if (!resolvedRoomId && canCreateChatRoom) {
            const resolvedRoom = await resolveStandardChatRoom({ viewerUid, targetAuthUid: targetAuthUidForRoom, roomType: expectedRoomType, studentId });
            resolvedRoomId = resolvedRoom?.id || buildStandardRoomId(expectedRoomType, viewerUid, targetAuthUidForRoom, studentId);
            shouldCreateStandardRoom = !resolvedRoom;
        }
        if (!resolvedRoomId && allowLegacyResolve) resolvedRoomId = await resolveRoomId(studentId, studentAuthUid);
        if (!resolvedRoomId && !canCreateChatRoom) return;
        const localCreatedAtMs = Date.now();
        const clientTempId = `client-${localCreatedAtMs}-${Math.random().toString(36).slice(2, 10)}`;
        const optimisticMessage = {
            id: clientTempId,
            roomId: resolvedRoomId,
            text,
            senderId: viewerUid,
            senderRole: isChatRoomMode ? userRole : userRole,
            senderName: buildSenderName(),
            createdAt: new Date(localCreatedAtMs),
            localCreatedAtMs,
            pending: true,
            clientTempId,
        };
        const myIds = new Set([auth.currentUser?.uid, myProfileDocId].filter(Boolean).map(String));
        setOptimisticMessages((prev) => {
            const next = sortMessageItems(dedupeMessages([
                ...prev.map((item) => ({ id: item.id, raw: item })),
                { id: optimisticMessage.id, raw: optimisticMessage },
            ])).map((item) => item.raw);
            optimisticMessagesRef.current = next;
            return next;
        });
        setMessages((prev) => sortMessageItems(dedupeMessages([
            ...prev.map((item) => ({ id: item.id, raw: item })),
            { id: optimisticMessage.id, raw: optimisticMessage },
        ])).map((item) => normalizeMessage(item.id, item.raw, myIds, teacherName || '메시지')).filter((item) => item.text));
        setInputText('');

        try {
            if (isChatRoomMode) {
                if (canCreateChatRoom && shouldCreateStandardRoom) {
                    let parentDocId = myProfileDocId;
                    if (!parentDocId && viewerUid) {
                        try {
                            const indexSnap = await getDoc(doc(db, 'userAuthIndex', viewerUid));
                            parentDocId = indexSnap.exists() ? String(indexSnap.data()?.userDocId || viewerUid) : String(viewerUid);
                            setMyProfileDocId(parentDocId);
                        } catch (indexError) {
                            logFirestoreQueryFailure('load userAuthIndex before room create', indexError, { doc: ['userAuthIndex', viewerUid] });
                            parentDocId = String(viewerUid);
                        }
                    }

                    const targetAuthUid = String(roomCreationContext?.targetAuthUid || '');
                    const targetName = String(roomCreationContext?.targetName || teacherName || '메시지');
                    const slot = String(roomCreationContext?.slot || normalizedChatSlot || 'direct');
                    const roomType = expectedRoomType || getExpectedRoomType(userRole, slot);
                    resolvedRoomId = resolvedRoomId || buildStandardRoomId(roomType, viewerUid, targetAuthUid, studentId);
                    const roomRef = doc(db, 'chatRooms', resolvedRoomId);
                    const targetRole = slot === 'teacher' ? 'teacher' : 'staff';
                    const roomPayload = {
                        participantIds: [String(viewerUid), targetAuthUid],
                        participantRoles: { [String(viewerUid)]: userRole, [targetAuthUid]: targetRole },
                        participantNames: { [String(viewerUid)]: buildSenderName(), [targetAuthUid]: targetName },
                        participantUserDocIds: { [String(viewerUid)]: parentDocId || String(studentId || viewerUid) },
                        studentId: String(studentId || ''),
                        type: 'individual',
                        roomType,
                        channel: roomType,
                        slot,
                        targetRole,
                        counterpartUid: targetAuthUid,
                        internalOnly: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        createdBy: String(viewerUid),
                        updatedBy: String(viewerUid),
                    };

                    if (userRole === 'parent') {
                        roomPayload.parentId = parentDocId || String(viewerUid);
                        roomPayload.parentUid = String(viewerUid);
                    } else if (userRole === 'student') {
                        roomPayload.studentUid = String(viewerUid);
                        roomPayload.studentAuthUid = String(viewerUid);
                    }

                    if (slot === 'teacher') {
                        roomPayload.teacherAuthUid = targetAuthUid;
                        roomPayload.teacherName = targetName;
                    } else {
                        roomPayload.staffAuthUid = targetAuthUid;
                        roomPayload.staffName = targetName;
                    }

                    await setDoc(roomRef, roomPayload, { merge: true });
                    console.log('[messenger] resolved room', {
                        roomId: resolvedRoomId,
                        roomType: roomPayload.roomType,
                        participantIds: roomPayload.participantIds,
                    });
                    if (userRole === 'parent' && slot === 'institute') {
                        console.log('[parent messenger] selected institute room', {
                            roomId: resolvedRoomId,
                            roomType: roomPayload.roomType,
                            channel: roomPayload.channel,
                            participantIds: roomPayload.participantIds,
                            parentUid: roomPayload.parentUid,
                            studentId: roomPayload.studentId,
                        });
                    }
                }
                
                await addDoc(collection(db, 'chatRooms', resolvedRoomId, 'messages'), {
                    roomId: resolvedRoomId,
                    senderId: viewerUid,
                    senderRole: userRole,
                    senderName: buildSenderName(),
                    messageType: 'text',
                    text,
                    attachments: [],
                    createdAt: serverTimestamp(),
                    localCreatedAtMs,
                    clientTempId,
                    internalOnly: true,
                    readBy: [viewerUid],
                });

                await updateDoc(doc(db, 'chatRooms', resolvedRoomId), {
                    lastMessageText: text,
                    lastMessageAt: serverTimestamp(),
                    lastMessageSenderId: viewerUid,
                    updatedAt: serverTimestamp(),
                    updatedBy: viewerUid,
                });
            } else {
                const roomRef = doc(db, 'chats', resolvedRoomId);
                const roomPatch = {
                    participantIds: arrayUnion(String(viewerUid)),
                    parentUid: String(viewerUid),
                    parentUids: arrayUnion(String(viewerUid)),
                    updatedAt: serverTimestamp(),
                    lastMessageAt: serverTimestamp(),
                    lastMessage: text,
                };
                if (studentId) {
                    roomPatch.studentId = String(studentId);
                }
                await updateDoc(roomRef, roomPatch);

                await addDoc(collection(db, 'chats', resolvedRoomId, 'messages'), {
                    text,
                    senderId: viewerUid,
                    senderRole: userRole,
                    senderName: '학부모',
                    createdAt: serverTimestamp(),
                    localCreatedAtMs,
                    clientTempId,
                });
            }
            console.log('[messenger] message sent', { roomId: resolvedRoomId, senderId: viewerUid });
            setError('');
            setRoomId(resolvedRoomId);
        } catch (sendError) {
            setOptimisticMessages((prev) => {
                const next = prev.filter((item) => item.clientTempId !== clientTempId);
                optimisticMessagesRef.current = next;
                return next;
            });
            setMessages((prev) => prev.filter((item) => item.clientTempId !== clientTempId));
            setInputText(text);
            logFirestoreQueryFailure('send message', sendError, isChatRoomMode ? {
                addDoc: { collection: `chatRooms/${resolvedRoomId}/messages`, fields: ['roomId', 'senderId', 'senderRole', 'senderName', 'messageType', 'text', 'attachments', 'createdAt', 'localCreatedAtMs', 'clientTempId', 'internalOnly', 'readBy'] },
                updateDoc: { doc: ['chatRooms', resolvedRoomId], fields: ['lastMessageText', 'lastMessageAt', 'lastMessageSenderId', 'updatedAt', 'updatedBy'] },
            } : {
                updateDoc: { doc: ['chats', resolvedRoomId], fields: ['participantIds', 'parentUid', 'parentUids', 'updatedAt', 'lastMessageAt', 'lastMessage', ...(studentId ? ['studentId'] : [])] },
                addDoc: { collection: `chats/${resolvedRoomId}/messages`, fields: ['text', 'senderId', 'senderRole', 'senderName', 'createdAt', 'localCreatedAtMs', 'clientTempId'] },
            });
            setError('메시지를 보낼 권한이 없습니다. 관리자에게 문의해주세요.');
        }
    };

    return (
        <div className={`${isFloating ? 'fixed bottom-24 right-5' : ''} bg-white h-full flex flex-col`}>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-gray-50 custom-scrollbar">
                {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
                {messages.length > 0 ? messages.map((msg, index) => {
                    const previous = messages[index - 1];
                    const showDateDivider = !previous || previous.date !== msg.date;
                    return (
                        <React.Fragment key={msg.id}>
                            {showDateDivider && (
                                <div className="flex items-center gap-3 py-1">
                                    <div className="flex-1 h-px bg-gray-200" />
                                    <p className="text-xs text-gray-400 whitespace-nowrap">{msg.dateLabel}</p>
                                    <div className="flex-1 h-px bg-gray-200" />
                                </div>
                            )}
                            <div className={`flex items-end gap-1.5 ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                {msg.isMe && <span className="text-[11px] text-gray-400 whitespace-nowrap self-end mb-1">{msg.time}</span>}
                                <div className={`max-w-[72%] px-3 py-2 rounded-2xl text-sm ${msg.isMe ? 'bg-[#455fab] text-white' : 'bg-white text-gray-900 border border-gray-100'}`}>
                                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                </div>
                                {!msg.isMe && <span className="text-[11px] text-gray-400 whitespace-nowrap self-end mb-1">{msg.time}</span>}
                            </div>
                        </React.Fragment>
                    );
                }) : (
                    <div className="text-center py-10 text-xs text-gray-500">{emptyMessage}</div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="sticky bottom-0 p-3 bg-white border-t border-gray-100 flex gap-2">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                <button type="submit" disabled={!inputText.trim()} className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-900 text-white disabled:bg-gray-300">
                    전송
                </button>
            </form>
        </div>
    );
}

export { CANDIDATE_ROOM_IDS };