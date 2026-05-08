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
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/client';

const CANDIDATE_ROOM_IDS = (studentId) => [String(studentId || '')].filter(Boolean);

const getMessageSortTime = (message) => {
    const value = message?.createdAt;
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

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
    const createdAtDate = data?.createdAt?.toDate?.() || (data?.createdAt ? new Date(data.createdAt) : null) || new Date();
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

export default function StudentMessenger({ studentId, studentAuthUid = '', selectedRoomId = '', teacherName = '메시지', userRole = 'parent', isFloating = false, allowLegacyResolve = true, emptyMessage = '아직 대화 내역이 없습니다.' }) {
    const [roomId, setRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [error, setError] = useState('');
    const [myProfileDocId, setMyProfileDocId] = useState('');
    const messagesEndRef = useRef(null);

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
            setRoomId(String(selectedRoomId));
            return undefined;
        }
        if (!allowLegacyResolve) {
            setRoomId(null);
            setMessages([]);
            setError('');
            return undefined;
        }
        let mounted = true;
        setRoomId(null);
        setMessages([]);

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
    }, [studentId, studentAuthUid, selectedRoomId, allowLegacyResolve]);

    useEffect(() => {
        if (!roomId) return undefined;
        
        const isChatRoomMode = !!selectedRoomId;
        const collectionPath = isChatRoomMode ? `chatRooms/${roomId}/messages` : `chats/${roomId}/messages`;
        const collectionArgs = isChatRoomMode ? ['chatRooms', roomId, 'messages'] : ['chats', roomId, 'messages'];
        let fallbackUnsub = null;

        const applySnapshot = (snap) => {
            const myIds = new Set([auth.currentUser?.uid, myProfileDocId].filter(Boolean).map(String));
            const fallbackSenderName = teacherName || '메시지';
            setError('');
            setMessages(snap.docs
                .map((item) => ({ id: item.id, raw: item.data() }))
                .sort((a, b) => getMessageSortTime(a.raw) - getMessageSortTime(b.raw))
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
    }, [roomId, selectedRoomId, myProfileDocId, teacherName]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const placeholder = useMemo(() => (userRole === 'parent' ? '메시지 보내기...' : '메시지 입력'), [userRole]);

    const handleSend = async (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text) return;

        const resolvedRoomId = selectedRoomId ? String(selectedRoomId) : roomId || (allowLegacyResolve ? await resolveRoomId(studentId, studentAuthUid) : null);
        if (!resolvedRoomId) return;

        const viewerUid = auth.currentUser?.uid || 'parent-anonymous';
        const isChatRoomMode = !!selectedRoomId;
        try {
            if (isChatRoomMode) {
                await addDoc(collection(db, 'chatRooms', resolvedRoomId, 'messages'), {
                    roomId: resolvedRoomId,
                    senderId: viewerUid,
                    senderRole: 'parent',
                    senderName: buildSenderName(),
                    messageType: 'text',
                    text,
                    attachments: [],
                    createdAt: serverTimestamp(),
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
                });
            }
            setError('');
            setRoomId(resolvedRoomId);
            setInputText('');
        } catch (sendError) {
            logFirestoreQueryFailure('send message', sendError, isChatRoomMode ? {
                addDoc: { collection: `chatRooms/${resolvedRoomId}/messages`, fields: ['roomId', 'senderId', 'senderRole', 'senderName', 'messageType', 'text', 'attachments', 'createdAt', 'internalOnly', 'readBy'] },
                updateDoc: { doc: ['chatRooms', resolvedRoomId], fields: ['lastMessageText', 'lastMessageAt', 'lastMessageSenderId', 'updatedAt', 'updatedBy'] },
            } : {
                updateDoc: { doc: ['chats', resolvedRoomId], fields: ['participantIds', 'parentUid', 'parentUids', 'updatedAt', 'lastMessageAt', 'lastMessage', ...(studentId ? ['studentId'] : [])] },
                addDoc: { collection: `chats/${resolvedRoomId}/messages`, fields: ['text', 'senderId', 'senderRole', 'senderName', 'createdAt'] },
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
                            {userRole !== 'parent' && !msg.isMe && msg.senderName && (
                                <p className="ml-1 mb-1 text-xs font-semibold text-gray-500">{msg.senderName}</p>
                            )}
                            <div className={`flex items-end gap-1.5 ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                {msg.isMe && <span className="text-[11px] text-gray-400 whitespace-nowrap self-end mb-1">{msg.time}</span>}
                                <div className={`max-w-[72%] px-3 py-2 rounded-2xl text-sm ${msg.isMe ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 border border-gray-100'}`}>
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