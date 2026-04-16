import React from 'react';
import { getChatRoomDisplayTitle } from './messengerTargets';

export default function ChatRoomList({
    rooms = [],
    selectedRoomId = null,
    onSelectRoom,
    myUid,
    contextData = {},
}) {
    return (
        <div className="border rounded-lg overflow-hidden bg-white">
            <div className="px-3 py-2 border-b text-sm font-semibold text-gray-600">상담 채팅방</div>
            <ul className="max-h-[420px] overflow-y-auto">
                {rooms.length === 0 && (
                    <li className="px-3 py-6 text-sm text-gray-400">생성된 채팅방이 없습니다.</li>
                )}
                {rooms.map((room) => {
                    const active = room.id === selectedRoomId;
                    const counterpartName = getChatRoomDisplayTitle(room, myUid, contextData);
                    return (
                        <li key={room.id}>
                            <button
                                type="button"
                                onClick={() => onSelectRoom(room)}
                                className={`w-full text-left px-3 py-3 border-b transition ${
                                    active ? 'bg-green-50' : 'hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-gray-700 truncate">{counterpartName}</span>
                                    <span className="text-[11px] text-gray-400 shrink-0">{room.type || 'individual'}</span>
                                </div>
                                <p className="text-xs text-gray-500 truncate mt-1">{room.lastMessageText || '메시지가 없습니다.'}</p>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}