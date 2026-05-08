import React, { useEffect, useState } from 'react';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import StudentMessenger from '../../components/StudentMessenger';
import { auth, db } from '../../firebase/client';

const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const roomDisplayName = (room) => {
    if (room?.name) return String(room.name);
    if (room?.title) return String(room.title);
    if (room?.displayName) return String(room.displayName);
    if (room?.teacherName) return String(room.teacherName);
    if (room?.staffName) return String(room.staffName);
    return '메시지';
};

export default function ParentMessengerPage({ studentId, student, onBack }) {
    const [rooms, setRooms] = useState([]);
    const [error, setError] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState('');

    const viewerUid = String(auth.currentUser?.uid || '');
    useEffect(() => {
        if (!viewerUid) return undefined;

        console.log('[parent messenger] viewerUid', viewerUid);
        const q = query(
            collection(db, 'chats'),
            where('participantIds', 'array-contains', viewerUid)
        );
        console.log('[parent messenger] query', {
            collection: 'chats',
            where: ['participantIds', 'array-contains', viewerUid],
        });
        const unsub = onSnapshot(q, (snap) => {
            setError('');
            const nextRooms = snap.docs
                .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                .sort((a, b) => {
                    const aAt = toDate(a?.updatedAt || a?.lastMessageAt)?.getTime() || 0;
                    const bAt = toDate(b?.updatedAt || b?.lastMessageAt)?.getTime() || 0;
                    return bAt - aAt;
                });
            setRooms(nextRooms);
        }, (snapshotError) => {
            console.error('[parent messenger] failed to load chats', {
                code: snapshotError?.code,
                message: snapshotError?.message,
                details: snapshotError,
                query: {
                    collection: 'chats',
                    where: ['participantIds', 'array-contains', viewerUid],
                },
            });
            setRooms([]);
            setError('대화 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        });

        return () => unsub && unsub();
    }, [viewerUid]);

    if (selectedRoomId) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
                    <button type="button" onClick={() => setSelectedRoomId('')} className="text-gray-700">
                        <ArrowBackIosNewIcon style={{ fontSize: 18 }} />
                    </button>
                    <h1 className="text-base font-semibold text-gray-900">메시지</h1>
                </header>
                <div className="flex-1">
                    <StudentMessenger
                        studentId={studentId}
                        studentAuthUid={student?.authUid || student?.studentUid || student?.uid || ''}
                        selectedRoomId={selectedRoomId}
                        userRole="parent"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3 sticky top-0">
                <button type="button" onClick={onBack} className="text-gray-700">
                    <ArrowBackIosNewIcon style={{ fontSize: 18 }} />
                </button>
                <h1 className="text-base font-semibold text-gray-900">메시지</h1>
            </header>
            <section className="py-2">
                {error && <div className="mx-4 mb-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2">{error}</div>}
                {rooms.length === 0 && !error && <div className="mx-4 mt-4 text-xs text-gray-500">아직 대화 내역이 없습니다.</div>}
                {rooms.map((room) => (
                    <button key={room.id} type="button" onClick={() => setSelectedRoomId(room.id)} className="h-16 w-full px-4 bg-white border-b border-gray-100 flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{roomDisplayName(room)}</p>
                            <p className="text-xs text-gray-500 truncate">{String(room?.lastMessage || '대화 내역이 없습니다.')}</p>
                        </div>
                        <div className="text-[11px] text-gray-400">
                            {toDate(room?.updatedAt || room?.lastMessageAt)?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || ''}
                        </div>
                    </button>
                ))}
            </section>
        </div>
    );
}