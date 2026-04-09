import React, { useEffect, useMemo, useState } from 'react';
import {
    broadcastChatMessage,
    createOrGetChatRoom,
    sendChatMessage,
    subscribeChatMessages,
    subscribeInternalChatRooms,
} from '../../domain/messenger/messenger.service';
import { isStaffOrTeachingRole } from '../../constants/roles';
import ChatRoomList from './ChatRoomList';
import ChatMessagePane from './ChatMessagePane';

export default function InternalMessengerPanel({ userId, userRole, students = [], parents = [] }) {
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [targetUid, setTargetUid] = useState('');
    const [broadcastText, setBroadcastText] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    const targetOptions = useMemo(() => {
        const studentOptions = (students || [])
            .filter((item) => item?.authUid)
            .map((item) => ({
                authUid: item.authUid,
                role: 'student',
                label: `[학생] ${item.name || item.studentName || item.id}`,
                userDocId: item.id || null,
                name: item.name || item.studentName || '',
                studentId: item.id || null,
            }));

        const parentOptions = (parents || [])
            .filter((item) => item?.authUid)
            .map((item) => ({
                authUid: item.authUid,
                role: 'parent',
                label: `[학부모] ${item.name || item.parentName || item.id}`,
                userDocId: item.id || null,
                name: item.name || item.parentName || '',
                parentId: item.id || null,
            }));

        const merged = [...studentOptions, ...parentOptions];
        const uniqueMap = new Map();
        merged.forEach((option) => {
            if (!uniqueMap.has(option.authUid)) uniqueMap.set(option.authUid, option);
        });
        return Array.from(uniqueMap.values());
    }, [students, parents]);

    useEffect(() => {
        if (!isStaffOrTeachingRole(userRole) || !userId) return () => {};
        return subscribeInternalChatRooms(userId, setRooms, (error) => {
            console.error('[internal-messenger] room subscribe failed', error);
        });
    }, [userId, userRole]);

    useEffect(() => {
        if (!selectedRoom?.id) {
            setMessages([]);
            return () => {};
        }

        return subscribeChatMessages(selectedRoom.id, setMessages, (error) => {
            console.error('[internal-messenger] message subscribe failed', error);
        });
    }, [selectedRoom?.id]);

    const handleCreateOrOpenRoom = async () => {
        if (!targetUid) return;
        const target = targetOptions.find((option) => option.authUid === targetUid);
        if (!target) return;

        try {
            const result = await createOrGetChatRoom({
                targetAuthUid: target.authUid,
                targetUserDocId: target.userDocId,
                targetRole: target.role,
                targetName: target.name,
                studentId: target.studentId || null,
                parentId: target.parentId || null,
            });

            setStatusMessage(`채팅방 준비 완료: ${result?.roomId || ''}`);
            if (result?.roomId) {
                setSelectedRoom((prev) => (prev?.id === result.roomId ? prev : { id: result.roomId }));
            }
        } catch (error) {
            console.error('[internal-messenger] create room failed', error);
            setStatusMessage(`채팅방 생성 실패: ${error.message}`);
        }
    };

    const handleSendMessage = async (text) => {
        if (!selectedRoom?.id) return;
        await sendChatMessage({ roomId: selectedRoom.id, text });
    };

    const handleBroadcast = async () => {
        const text = broadcastText.trim();
        if (!text) return;
        const targetUserIds = targetOptions.map((option) => option.authUid);
        if (!targetUserIds.length) return;

        try {
            const result = await broadcastChatMessage({
                text,
                targetUserIds,
                targetType: 'custom',
            });
            setStatusMessage(`브로드캐스트 완료: ${result?.successCount || 0}건`);
            setBroadcastText('');
        } catch (error) {
            console.error('[internal-messenger] broadcast failed', error);
            setStatusMessage(`브로드캐스트 실패: ${error.message}`);
        }
    };

    if (!isStaffOrTeachingRole(userRole)) {
        return <div className="bg-white p-4 rounded-xl shadow text-sm text-gray-500">내부 운영자만 접근 가능합니다.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">1:1 채팅 시작 (학생/학부모)</p>
                <div className="flex flex-wrap items-center gap-2">
                    <select value={targetUid} onChange={(event) => setTargetUid(event.target.value)} className="border rounded px-3 py-2 text-sm min-w-[260px]">
                        <option value="">대상 사용자 선택</option>
                        {targetOptions.map((option) => (
                            <option key={option.authUid} value={option.authUid}>{option.label}</option>
                        ))}
                    </select>
                    <button type="button" onClick={handleCreateOrOpenRoom} className="px-3 py-2 text-sm rounded bg-green-600 text-white">채팅방 생성/열기</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        value={broadcastText}
                        onChange={(event) => setBroadcastText(event.target.value)}
                        placeholder="전체 대상 fan-out 메시지 (개발용)"
                        className="border rounded px-3 py-2 text-sm min-w-[260px] flex-1"
                    />
                    <button type="button" onClick={handleBroadcast} className="px-3 py-2 text-sm rounded border border-gray-300">단체 발송 테스트</button>
                </div>
                {statusMessage && <p className="text-xs text-gray-500">{statusMessage}</p>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                    <ChatRoomList rooms={rooms} selectedRoomId={selectedRoom?.id || null} onSelectRoom={setSelectedRoom} myUid={userId} />
                </div>
                <div className="lg:col-span-2">
                    <ChatMessagePane room={selectedRoom} messages={messages} myUid={userId} onSend={handleSendMessage} />
                </div>
            </div>
        </div>
    );
}