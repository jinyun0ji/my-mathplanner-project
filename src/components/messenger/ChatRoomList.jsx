import React from 'react';
import { getChatRoomDisplayTitle } from './messengerTargets';

const normalizeRoomDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') {
        const converted = value.toDate();
        return Number.isNaN(converted?.getTime?.()) ? null : converted;
    }
    if (typeof value?.seconds === 'number') {
        const date = new Date((value.seconds * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1_000_000));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatRoomTime = (room) => {
    const date = normalizeRoomDate(room?.lastMessageAt || room?.updatedAt || room?.createdAt);
    if (!date) return '';
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

const getUnreadCount = (room, myUid) => {
    const direct = Number(room?.unreadCount || room?.unreadMessageCount || room?.unread || 0);
    if (direct > 0) return direct;
    const perUser = room?.unreadCounts || room?.unreadByUser || room?.unreadByParticipant || {};
    const keyed = Number(perUser?.[myUid] || 0);
    return keyed > 0 ? keyed : 0;
};

const getRoomPreview = (room) => room?.lastMessageText || room?.lastMessage || room?.message || '대화 내역이 없습니다.';

export default function ChatRoomList({
    rooms = [],
    selectedRoomId = null,
    onSelectRoom,
    myUid,
    contextData = {},
    mobile = false,
    title = '상담 채팅방',
}) {
    return (
        <div className="border rounded-lg overflow-hidden bg-white">
            <div className={`${mobile ? 'px-4 py-3' : 'px-3 py-2'} border-b text-sm font-semibold text-gray-600`}>{title}</div>
            <ul className={mobile ? 'overflow-y-auto' : 'max-h-[420px] overflow-y-auto'}>
                {rooms.length === 0 && (
                    <li className="px-3 py-6 text-sm text-gray-400">생성된 채팅방이 없습니다.</li>
                )}
                {rooms.map((room) => {
                    const active = room.id === selectedRoomId;
                    const counterpartName = getChatRoomDisplayTitle(room, myUid, contextData);
                    const unreadCount = getUnreadCount(room, myUid);
                    return (
                        <li key={room.id}>
                            <button
                                type="button"
                                onClick={() => onSelectRoom(room)}
                                className={`w-full text-left px-3 py-3 border-b transition ${
                                    active ? 'bg-green-50' : 'hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className={`${mobile ? 'text-sm font-semibold text-gray-900' : 'text-sm font-medium text-gray-700'} truncate`}>{counterpartName}</span>
                                    <span className="text-[11px] text-gray-400 shrink-0">{mobile ? formatRoomTime(room) : (room.roomType || room.channel || room.type || 'individual')}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                    <p className="min-w-0 flex-1 truncate text-xs text-gray-500">{getRoomPreview(room)}</p>
                                    {unreadCount > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}