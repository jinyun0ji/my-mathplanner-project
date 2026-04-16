import React, { useMemo, useState } from 'react';

const normalizeMessageDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') {
        const converted = value.toDate();
        return Number.isNaN(converted?.getTime?.()) ? null : converted;
    }
    if (typeof value?.seconds === 'number') {
        const ms = (value.seconds * 1000) + Math.floor((Number(value.nanoseconds || 0)) / 1_000_000);
        const date = new Date(ms);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getMessageDateKey = (message) => {
    const date = normalizeMessageDate(message?.createdAt);
    if (!date) return 'unknown-date';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatMessageDateDivider = (message) => {
    const date = normalizeMessageDate(message?.createdAt);
    if (!date) return '날짜 정보 없음';
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
    }).format(date);
};

const formatTime = (value) => {
    if (!value) return '';
    const date = normalizeMessageDate(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export default function ChatMessagePane({ room, messages = [], myUid, onSend }) {
    const [draft, setDraft] = useState('');

    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => {
            const av = normalizeMessageDate(a?.createdAt)?.getTime() || 0;
            const bv = normalizeMessageDate(b?.createdAt)?.getTime() || 0;
            return av - bv;
        });
    }, [messages]);

    const renderItems = useMemo(() => {
        const list = [];
        sortedMessages.forEach((message, index) => {
            const prevMessage = sortedMessages[index - 1] || null;
            const isFirst = index === 0;
            const hasDateChanged = getMessageDateKey(prevMessage) !== getMessageDateKey(message);
            if (isFirst || hasDateChanged) {
                list.push({
                    type: 'divider',
                    key: `divider-${message?.id || index}-${getMessageDateKey(message)}`,
                    label: formatMessageDateDivider(message),
                });
            }
            list.push({
                type: 'message',
                key: `message-${message?.id || index}`,
                message,
            });
        });
        return list;
    }, [sortedMessages]);

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
                {renderItems.map((item) => {
                    if (item.type === 'divider') {
                        return (
                            <div key={item.key} className="flex items-center gap-3 py-1">
                                <div className="flex-1 h-px bg-gray-200" />
                                <p className="text-[11px] text-gray-400">{item.label}</p>
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>
                        );
                    }

                    const message = item.message;
                    const mine = message.senderId === myUid;
                    return (
                        <div key={item.key} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
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