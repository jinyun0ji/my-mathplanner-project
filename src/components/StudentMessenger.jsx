import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { formatAttachmentSize, uploadChatAttachment, validateChatAttachment } from '../messenger/services/attachmentService';
import { buildDeterministicRoomId, createRoomIfMissing } from '../messenger/services/roomFactory';
import { sendRoomMessage, subscribeRoomMessages } from '../messenger/services/messageService';
import { fetchRoomsForIndexes } from '../messenger/services/userChatRoomsService';

// TODO(video_embed): allow only admin/staff/teacher to send YouTube watch/youtu.be/embed links,
// normalize them to youtube-nocookie URLs, store messageType: 'video_embed',
// render video cards in-room, and play them in an internal iframe modal.
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


const uniqueStrings = (values) => Array.from(new Set(
    values.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
));

const buildStandardRoomId = (roomType, ownerUid, counterpartUid, studentId = '') => buildDeterministicRoomId(roomType, ownerUid, counterpartUid, studentId);

const getParticipantIds = (room) => (Array.isArray(room?.participantIds) ? room.participantIds.map(String) : []);

const getRoomSlot = (room) => {
    const explicitSlot = String(room?.slot || '').trim();
    if (explicitSlot) return explicitSlot;
    const roomType = String(room?.roomType || room?.channel || '').trim();
    if (roomType === 'institute' || roomType.endsWith('_institute')) return 'institute';
    if (roomType === 'teacher' || roomType.endsWith('_teacher')) return 'teacher';
    return '';
};

const normalizedRoleFromRoomType = (roomType) => (String(roomType || '').startsWith('parent_') ? 'parent' : 'student');

const hasRoomTypeOrChannel = (room, expectedRoomType) => (
    String(room?.roomType || '').trim() === expectedRoomType
    || String(room?.channel || '').trim() === expectedRoomType
);

const isResolvedRoomCandidate = (room, { viewerUid, targetAuthUid, roomType, studentId = '', participantKeys = [] }) => {
    if (!room || !viewerUid || !targetAuthUid || !roomType) return false;
    const expectedSlot = roomType.endsWith('_teacher') ? 'teacher' : 'institute';
    const roomSlot = getRoomSlot(room);
    const participantIds = getParticipantIds(room);
    const viewerKeys = uniqueStrings([viewerUid, participantKeys]);
    if (!viewerKeys.some((key) => participantIds.includes(key))) return false;
    if (!participantIds.includes(String(targetAuthUid)) && String(room?.counterpartUid || '') !== String(targetAuthUid) && String(room?.teacherAuthUid || '') !== String(targetAuthUid) && String(room?.staffAuthUid || '') !== String(targetAuthUid)) return false;
    if (roomSlot && roomSlot !== expectedSlot) return false;
    if (!hasRoomTypeOrChannel(room, roomType) && getRoomSlot(room) !== expectedSlot) return false;
    if (roomType.startsWith('student_') && (hasRoomTypeOrChannel(room, 'parent_teacher') || hasRoomTypeOrChannel(room, 'parent_institute'))) return false;
    if (roomType.startsWith('parent_') && (hasRoomTypeOrChannel(room, 'student_teacher') || hasRoomTypeOrChannel(room, 'student_institute'))) return false;
    if ((roomType === 'parent_teacher' || roomType === 'parent_institute') && studentId && room?.studentId && String(room.studentId) !== String(studentId)) return false;
    if (expectedSlot === 'teacher' && room?.teacherAuthUid && String(room.teacherAuthUid) !== String(targetAuthUid)) return false;
    if (expectedSlot === 'institute' && room?.staffAuthUid && String(room.staffAuthUid) !== String(targetAuthUid)) return false;
    if (room?.counterpartUid && String(room.counterpartUid) !== String(targetAuthUid)) return false;
    return true;
};

const resolveChatRoom = async ({ viewerUid, targetAuthUid, roomType, studentId = '', participantKeys = [] }) => {
    const authUid = String(auth.currentUser?.uid || viewerUid || '').trim();
    if (!authUid || !targetAuthUid || !roomType) return null;
    try {
        const indexSnap = await getDocs(collection(db, 'userChatRooms', authUid, 'rooms'));
        if (process.env.NODE_ENV === 'development') {
            console.log('[resolver] userChatRooms snapshot', {
                role: normalizedRoleFromRoomType(roomType),
                authUid,
                count: indexSnap.docs.length,
                ids: indexSnap.docs.map((item) => item.id),
            });
        }
        const rooms = await fetchRoomsForIndexes(indexSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
        return rooms
            .filter((room) => isResolvedRoomCandidate(room, { viewerUid: authUid, targetAuthUid, roomType, studentId, participantKeys }))
            .sort((left, right) => getMessageSortTime({ createdAt: right.lastMessageAt || right.updatedAt || right.createdAt }) - getMessageSortTime({ createdAt: left.lastMessageAt || left.updatedAt || left.createdAt }))[0] || null;
    } catch (resolveError) {
        logFirestoreQueryFailure('resolve userChatRooms room', resolveError, { collection: `userChatRooms/${authUid}/rooms` });
        return null;
    }
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
        messageType: data?.messageType || (Array.isArray(data?.attachments) && data.attachments.length ? (data.attachments[0]?.type === 'image' ? 'image' : 'file') : 'text'),
        attachments: Array.isArray(data?.attachments) ? data.attachments : [],
    };
};

export default function StudentMessenger({ studentId, studentAuthUid = '', selectedRoomId = '', teacherName = '메시지', userRole = 'parent', isFloating = false, allowLegacyResolve = true, emptyMessage = '아직 대화 내역이 없습니다.', chatSlot = '', roomCreationContext = null }) {
    const [roomId, setRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [optimisticMessages, setOptimisticMessages] = useState([]);
    const optimisticMessagesRef = useRef([]);
    const [inputText, setInputText] = useState('');
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [imageModal, setImageModal] = useState(null);
    const [myProfileDocId, setMyProfileDocId] = useState('');
    const messagesEndRef = useRef(null);
    const normalizedChatSlot = String(chatSlot || roomCreationContext?.slot || '');
    const roomStudentParticipantKeys = useMemo(() => uniqueStrings([roomCreationContext?.studentParticipantKeys]), [roomCreationContext?.studentParticipantKeys]);
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
            if (process.env.NODE_ENV === 'development') console.log('[StudentMessenger] selected roomId', { roomId: String(selectedRoomId) });
            setMessages([]);
            setOptimisticMessages([]);
            setRoomId(String(selectedRoomId));
            return undefined;
        }

        let cancelled = false;
        setRoomId(null);
        setMessages([]);
        setOptimisticMessages([]);
        setError('');

        const viewerUid = auth.currentUser?.uid || '';
        const targetAuthUid = String(roomCreationContext?.targetAuthUid || '');
        if (!viewerUid || !targetAuthUid || !expectedRoomType) return () => { cancelled = true; };

        resolveChatRoom({
            viewerUid,
            targetAuthUid,
            roomType: expectedRoomType,
            studentId,
            participantKeys: roomStudentParticipantKeys,
        }).then((resolvedRoom) => {
            if (cancelled || !resolvedRoom?.id) return;
            if (process.env.NODE_ENV === 'development') console.log('[student messenger] resolved room', { roomId: resolvedRoom.id, messagesPath: `chatRooms/${resolvedRoom.id}/messages` });
            setRoomId(String(resolvedRoom.id));
        });

        return () => {
            cancelled = true;
        };
    }, [studentId, studentAuthUid, selectedRoomId, allowLegacyResolve, canCreateChatRoom, expectedRoomType, roomCreationContext?.targetAuthUid, normalizedChatSlot, userRole, roomStudentParticipantKeys]);

    useEffect(() => {
        if (!roomId) return undefined;
        
        const collectionPath = `chatRooms/${roomId}/messages`;
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
                .filter((item) => item.text || item.attachments.length));
        };

        const subscribe = (withOrderBy) => {
            const queryShape = withOrderBy
                ? { collection: collectionPath, orderBy: ['createdAt', 'asc'] }
                : { collection: collectionPath, orderBy: null, clientSort: ['createdAt', 'asc'] };
            if (process.env.NODE_ENV === 'development') {
                console.log('[StudentMessenger] subscribe messages', { roomId, path: collectionPath });
                console.log('[student messenger][messages path]', { authUid: auth.currentUser?.uid || '', studentId: String(studentId || ''), studentAuthUid: String(studentAuthUid || ''), selectedRoomId: String(selectedRoomId || roomId || ''), roomType: expectedRoomType, channel: expectedRoomType, slot: normalizedChatSlot, participantIds: roomStudentParticipantKeys, lastMessageText: '', messagesPath: collectionPath, queryShape });
            }
            return subscribeRoomMessages({ roomId, withOrderBy, onNext: applySnapshot, onError: (snapshotError) => {
                if (process.env.NODE_ENV === 'development') logFirestoreQueryFailure('subscribe messages', snapshotError, queryShape);
                if (withOrderBy) {
                    fallbackUnsub = subscribe(false);
                    return;
                }
                setError('메시지를 불러올 권한이 없습니다. 관리자에게 문의해주세요.');
            } });
        };

        const unsub = subscribe(true);
        return () => {
            unsub && unsub();
            fallbackUnsub && fallbackUnsub();
        };
    }, [roomId, selectedRoomId, canCreateChatRoom, expectedRoomType, normalizedChatSlot, myProfileDocId, teacherName, userRole, studentId, studentAuthUid, roomStudentParticipantKeys]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const placeholder = useMemo(() => (userRole === 'parent' ? '메시지 보내기...' : '메시지 입력'), [userRole]);

    useEffect(() => () => {
        if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
    }, [attachmentPreviewUrl]);

    const clearAttachment = () => {
        if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
        setAttachmentPreviewUrl('');
        setAttachmentFile(null);
    };

    const handleAttachmentChange = (event) => {
        const file = event.target.files?.[0] || null;
        event.target.value = '';
        if (!file) return;
        const validation = validateChatAttachment(file);
        if (!validation.ok) {
            setError(validation.message);
            clearAttachment();
            return;
        }
        if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
        setAttachmentFile(file);
        setAttachmentPreviewUrl(validation.type === 'image' ? URL.createObjectURL(file) : '');
        setError('');
    };

    const handleSend = async (e) => {
        e.preventDefault();
        const text = inputText.trim();
        const fileToUpload = attachmentFile;
        if (!text && !fileToUpload) return;
        if (fileToUpload) {
            const validation = validateChatAttachment(fileToUpload);
            if (!validation.ok) {
                setError(validation.message);
                return;
            }
        }
        setIsSending(true);

        const viewerUid = auth.currentUser?.uid || 'parent-anonymous';
        const targetAuthUidForRoom = String(roomCreationContext?.targetAuthUid || '');
        const isChatRoomMode = userRole === 'student' || Boolean(selectedRoomId || canCreateChatRoom || String(expectedRoomType || '').includes('institute'));
        let resolvedRoomId = selectedRoomId ? String(selectedRoomId) : roomId || null;
        let shouldCreateStandardRoom = false;
        if (!resolvedRoomId && canCreateChatRoom) {
            resolvedRoomId = buildStandardRoomId(expectedRoomType, viewerUid, targetAuthUidForRoom, studentId);
            shouldCreateStandardRoom = Boolean(resolvedRoomId);
        }
        if (!resolvedRoomId && !canCreateChatRoom) return;
        const localCreatedAtMs = Date.now();
        const clientTempId = `client-${localCreatedAtMs}-${Math.random().toString(36).slice(2, 10)}`;
        const optimisticMessage = {
            id: clientTempId,
            roomId: resolvedRoomId,
            text,
            messageType: fileToUpload ? (fileToUpload.type === 'application/pdf' ? 'file' : 'image') : 'text',
            attachments: fileToUpload ? [{
                type: fileToUpload.type === 'application/pdf' ? 'pdf' : 'image',
                name: fileToUpload.name,
                url: attachmentPreviewUrl,
                path: '',
                size: fileToUpload.size,
                contentType: fileToUpload.type,
            }] : [],
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
        ])).map((item) => normalizeMessage(item.id, item.raw, myIds, teacherName || '메시지')).filter((item) => item.text || item.attachments.length));
        setInputText('');
        clearAttachment();

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
                    const targetRole = slot === 'teacher' ? 'teacher' : 'staff';
                    const isParentInstituteRoom = userRole === 'parent' && slot === 'institute';
                    const effectiveRoomType = isParentInstituteRoom ? 'parent_institute' : roomType;
                    const effectiveTargetRole = isParentInstituteRoom ? 'staff' : targetRole;
                    const effectiveTargetName = isParentInstituteRoom ? '채수용 수학 연구소' : targetName;
                    const roomPayload = {
                        participantIds: [String(viewerUid), targetAuthUid],
                        participantRoles: { [String(viewerUid)]: userRole, [targetAuthUid]: effectiveTargetRole },
                        participantNames: { [String(viewerUid)]: buildSenderName(), [targetAuthUid]: effectiveTargetName },
                        participantUserDocIds: { [String(viewerUid)]: parentDocId || String(studentId || viewerUid) },
                        studentId: String(studentId || ''),
                        type: 'individual',
                        roomType: effectiveRoomType,
                        channel: effectiveRoomType,
                        slot: isParentInstituteRoom ? 'institute' : slot,
                        targetRole: effectiveTargetRole,
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
                        roomPayload.teacherName = effectiveTargetName;
                    } else {
                        roomPayload.staffAuthUid = targetAuthUid;
                        roomPayload.staffName = effectiveTargetName;
                    }

                    await createRoomIfMissing({ roomId: resolvedRoomId, payload: roomPayload });
                    if (process.env.NODE_ENV === 'development') console.log('[student messenger] selected room', {
                        roomId: resolvedRoomId,
                        roomType: roomPayload.roomType,
                        channel: roomPayload.channel,
                        slot: roomPayload.slot,
                        participantIds: roomPayload.participantIds,
                        messagesPath: `chatRooms/${resolvedRoomId}/messages`,
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
                
                const uploadedAttachment = fileToUpload ? await uploadChatAttachment({
                    roomId: resolvedRoomId,
                    messageId: clientTempId,
                    file: fileToUpload,
                    uploaderUid: viewerUid,
                }) : null;
                const attachments = uploadedAttachment ? [uploadedAttachment] : [];
                const messageType = uploadedAttachment ? (uploadedAttachment.type === 'image' ? 'image' : 'file') : 'text';

                await sendRoomMessage({
                    roomId: resolvedRoomId,
                    updaterUid: viewerUid,
                    lastMessageText: text || (uploadedAttachment?.type === 'image' ? '사진 첨부' : 'PDF 첨부'),
                    message: {
                        senderId: viewerUid,
                        senderRole: userRole,
                        senderName: buildSenderName(),
                        messageType,
                        text,
                        attachments,
                        localCreatedAtMs,
                        clientTempId,
                        readBy: [viewerUid],
                    },
                });
            }
            if (process.env.NODE_ENV === 'development') console.log('[student messenger] message sent', { roomId: resolvedRoomId, senderId: viewerUid });
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
            if (fileToUpload) setAttachmentFile(fileToUpload);
            logFirestoreQueryFailure('send message', sendError, isChatRoomMode ? {
                addDoc: { collection: `chatRooms/${resolvedRoomId}/messages`, fields: ['roomId', 'senderId', 'senderRole', 'senderName', 'messageType', 'text', 'attachments', 'createdAt', 'localCreatedAtMs', 'clientTempId', 'internalOnly', 'readBy'] },
                updateDoc: { doc: ['chatRooms', resolvedRoomId], fields: ['lastMessageText', 'lastMessageAt', 'lastMessageSenderId', 'updatedAt', 'updatedBy'] },
            } : {});
            setError(sendError?.message || '메시지를 보낼 권한이 없습니다. 관리자에게 문의해주세요.');
        } finally {
            setIsSending(false);
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
                                    {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                                    {msg.attachments.map((attachment) => (
                                        attachment.type === 'image' ? (
                                            <button key={attachment.url || attachment.name} type="button" onClick={() => setImageModal(attachment)} className={`${msg.text ? 'mt-2 ' : ''}block text-left`}>
                                                <img src={attachment.url} alt={attachment.name} className="max-h-48 rounded-lg object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                                                <span className="mt-1 block text-xs underline break-all">{attachment.name}</span>
                                            </button>
                                        ) : (
                                            <a key={attachment.url || attachment.name} href={attachment.url} target="_blank" rel="noreferrer" className={`${msg.text ? 'mt-2 ' : ''}flex items-center gap-2 rounded-lg border border-current/20 px-2 py-1.5 text-xs`}>
                                                <span>📄</span><span className="break-all">{attachment.name}</span><span className="whitespace-nowrap opacity-75">{formatAttachmentSize(attachment.size)}</span>
                                            </a>
                                        )
                                    ))}
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

            {imageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setImageModal(null)}>
                    <div className="max-w-[96vw] max-h-[96vh] rounded-xl bg-white p-3 shadow-xl" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-gray-700">{imageModal.name || '이미지'}</p>
                            <button type="button" onClick={() => setImageModal(null)} className="rounded border px-2 py-1 text-xs">닫기</button>
                        </div>
                        <img src={imageModal.url} alt={imageModal.name || '첨부 이미지'} className="max-h-[78vh] max-w-[90vw] rounded-lg object-contain" />
                        {imageModal.url && <a href={imageModal.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">원본 열기</a>}
                    </div>
                </div>
            )}

            {attachmentFile && (
                <div className="px-3 py-2 border-t bg-white flex items-center gap-3 text-xs">
                    {attachmentPreviewUrl && <img src={attachmentPreviewUrl} alt="첨부 미리보기" className="h-12 w-12 rounded object-cover" />}
                    <span className="flex-1 truncate">{attachmentFile.name} · {formatAttachmentSize(attachmentFile.size)}</span>
                    <button type="button" onClick={clearAttachment} className="text-red-500">취소</button>
                </div>
            )}
            <form onSubmit={handleSend} className="sticky bottom-0 p-3 bg-white border-t border-gray-100 flex gap-2">
                <label className="px-3 py-2 rounded-full border border-gray-200 bg-white text-sm cursor-pointer">
                    첨부
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleAttachmentChange} className="hidden" />
                </label>
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                <button type="submit" disabled={isSending || (!inputText.trim() && !attachmentFile)} className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-900 text-white disabled:bg-gray-300">
                    전송
                </button>
            </form>
        </div>
    );
}

export { CANDIDATE_ROOM_IDS };