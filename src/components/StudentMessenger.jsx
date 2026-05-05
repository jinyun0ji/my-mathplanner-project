import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    collection,
    addDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/client';

const CANDIDATE_ROOM_IDS = (studentId) => [String(studentId || '')].filter(Boolean);

const normalizeMessage = (id, data, viewerUid) => {
    const createdAtDate = data?.createdAt?.toDate?.() || (data?.createdAt ? new Date(data.createdAt) : null) || new Date();
    const senderId = String(data?.senderId || data?.senderUid || '');
    const senderRole = String(data?.senderRole || 'staff');
    return {
        id,
        text: data?.text || data?.message || '',
        isMe: !!viewerUid && senderId === String(viewerUid),
        senderRole,
        senderName: data?.senderName || (senderRole === 'parent' ? '학부모' : '학원 운영팀'),
        createdAt: createdAtDate,
        date: createdAtDate.toISOString().slice(0, 10),
        time: createdAtDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
};

async function resolveRoomId(studentId, studentAuthUid = '') {
    const sid = String(studentId || '');
    const suid = String(studentAuthUid || '');
    if (!sid && !suid) return null;

    const chatsRef = collection(db, 'chats');

    const checks = [
        async () => {
            if (!sid) return null;
            const snap = await getDocs(query(chatsRef, where('studentId', '==', sid), limit(1)));
            return snap.empty ? null : snap.docs[0].id;
        },
        async () => {
            if (!suid) return null;
            const snap = await getDocs(query(chatsRef, where('participants', 'array-contains', suid), limit(1)));
            return snap.empty ? null : snap.docs[0].id;
        },
        async () => {
            if (!suid) return null;
            const snap = await getDocs(query(chatsRef, where('participantIds', 'array-contains', suid), limit(1)));
            return snap.empty ? null : snap.docs[0].id;
        },
        async () => {
            if (!sid) return null;
            const direct = await getDoc(doc(db, 'chats', sid));
            return direct.exists() ? sid : null;
        },
    ];

    for (const check of checks) {
        const roomId = await check();
        if (roomId) return roomId;
    }

    return null;
}

export default function StudentMessenger({ studentId, studentAuthUid = '', teacherName = '학원 운영팀', userRole = 'parent', isFloating = false }) {
    const [roomId, setRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        let mounted = true;
        setRoomId(null);
        setMessages([]);

        resolveRoomId(studentId, studentAuthUid).then((resolved) => {
            if (mounted) setRoomId(resolved);
        });

        return () => {
            mounted = false;
        };
    }, [studentId, studentAuthUid]);

    useEffect(() => {
        if (!roomId) return undefined;
        const q = query(collection(db, 'chats', roomId, 'messages'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            const viewerUid = auth.currentUser?.uid || '';
            setMessages(snap.docs.map((item) => normalizeMessage(item.id, item.data(), viewerUid)).filter((item) => item.text));
        });
        return unsub;
    }, [roomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const placeholder = useMemo(() => `${teacherName}에게 메시지 보내기...`, [teacherName]);

    const handleSend = async (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || !studentId) return;

        const resolvedRoomId = roomId || (await resolveRoomId(studentId, studentAuthUid));
        if (!resolvedRoomId) return;

        const viewerUid = auth.currentUser?.uid || 'parent-anonymous';
        const roomRef = doc(db, 'chats', resolvedRoomId);
        await setDoc(roomRef, {
            studentId: String(studentId),
            participants: [String(studentId), String(viewerUid)],
            participantIds: [String(studentId), String(viewerUid)],
            updatedAt: serverTimestamp(),
            lastMessage: text,
        }, { merge: true });

        await addDoc(collection(db, 'chats', resolvedRoomId, 'messages'), {
            text,
            senderId: viewerUid,
            senderRole: userRole,
            senderName: '학부모',
            createdAt: serverTimestamp(),
        });
        setRoomId(resolvedRoomId);
        setInputText('');
    };

    return (
        <div className={`${isFloating ? 'fixed bottom-24 right-5' : ''} bg-white h-full flex flex-col`}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 custom-scrollbar min-h-[420px]">
                {messages.length > 0 ? messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.isMe ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-100'}`}>
                            {!msg.isMe && <p className="text-[10px] text-gray-500 mb-1">{msg.senderName}</p>}
                            <p>{msg.text}</p>
                            <p className={`text-[10px] mt-1 text-right ${msg.isMe ? 'text-gray-300' : 'text-gray-400'}`}>{msg.time}</p>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10 text-xs text-gray-500">대화 내역이 없습니다.</div>
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