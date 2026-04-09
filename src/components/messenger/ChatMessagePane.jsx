import React, { useMemo, useState } from 'react';

const formatTime = (value) => {
    if (!value) return '';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export default function ChatMessagePane({ room, messages = [], myUid, onSend }) {
    const [draft, setDraft] = useState('');

    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => {
            const av = a?.createdAt?.seconds || new Date(a?.createdAt || 0).getTime();
            const bv = b?.createdAt?.seconds || new Date(b?.createdAt || 0).getTime();
            return av - bv;
        });
    }, [messages]);

    const submitText = async () => {
        const text = draft.trim();
        if (!text || !room?.id) return;
        await onSend(text);
        setDraft('');
    };

    const submit = async (event) => {
        event.preventDefault();
        await submitText();
    };

    const handleKeyDown = async (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            await submitText();
        }
    };

    if (!room) {
        return <div className="border rounded-lg bg-white h-[420px] flex items-center justify-center text-sm text-gray-400">왼쪽에서 채팅방을 선택하세요.</div>;
    }

    return (
        <div className="border rounded-lg bg-white h-[420px] flex flex-col">
            <div className="px-3 py-2 border-b text-sm font-semibold text-gray-700">Room: {room.id}</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sortedMessages.length === 0 && <p className="text-xs text-gray-400">아직 메시지가 없습니다.</p>}
                {sortedMessages.map((message) => {
                    const mine = message.senderId === myUid;
                    return (
                        <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-green-100 text-gray-800' : 'bg-gray-100 text-gray-700'}`}>
                                <p className="whitespace-pre-wrap break-words">{message.text || ''}</p>
                                <p className="text-[10px] text-gray-400 mt-1 text-right">{formatTime(message.createdAt)}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
            <form onSubmit={submit} className="border-t p-2 flex gap-2 items-end">
                <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지 입력 (Enter 줄바꿈 / Ctrl+Enter 또는 Cmd+Enter 전송)"
                    rows={2}
                    className="flex-1 border rounded px-3 py-2 text-sm resize-y"
                />
                <button type="submit" className="px-3 py-2 rounded bg-green-600 text-white text-sm">전송</button>
            </form>
        </div>
    );
}