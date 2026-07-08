import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getChatRoomDisplayTitle } from './messengerTargets';
import { formatAttachmentSize, validateChatAttachment } from '../chatAttachments';

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
        weekday: 'long',
    }).format(date);
};

const formatTime = (value) => {
    if (!value) return '';
    const date = normalizeMessageDate(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getParticipantCount = (room) => {
    const candidates = [room?.participantIds, room?.participants, room?.memberIds, room?.members];
    const values = candidates.find((candidate) => Array.isArray(candidate));
    return values ? values.length : 2;
};

const shouldShowSenderName = (room) => getParticipantCount(room) > 2;

export default function ChatMessagePane({
    room,
    messages = [],
    myUid,
    onSend,
    onRetryMessage,
    contextData = {},
    mobileCompact = false,
}) {
    const [draft, setDraft] = useState('');
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [error, setError] = useState('');
    const [imageModal, setImageModal] = useState(null);
    const messagesContainerRef = useRef(null);

    const scrollMessagesToBottom = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }, []);

    const scheduleScrollToBottom = useCallback(() => {
        scrollMessagesToBottom();
        requestAnimationFrame(() => {
            scrollMessagesToBottom();
            setTimeout(scrollMessagesToBottom, 120);
        });
    }, [scrollMessagesToBottom]);

    const clearAttachment = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
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
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setAttachmentFile(file);
        setPreviewUrl(validation.type === 'image' ? URL.createObjectURL(file) : '');
        setError('');
    };

    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => {
            const av = normalizeMessageDate(a?.createdAt)?.getTime() || 0;
            const bv = normalizeMessageDate(b?.createdAt)?.getTime() || 0;
            return av - bv;
        });
    }, [messages]);

    useEffect(() => {
        if (!room?.id) return;
        scheduleScrollToBottom();
    }, [room?.id, sortedMessages.length, scheduleScrollToBottom]);

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
        if ((!text && !attachmentFile) || !room?.id) return;
        const file = attachmentFile;
        setDraft('');
        clearAttachment();
        await onSend(text, file ? { file } : null);
        scheduleScrollToBottom();
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
        return <div className={`${mobileCompact ? 'h-full border-0 rounded-none' : 'h-[420px] border rounded-lg'} bg-white flex items-center justify-center text-sm text-gray-400`}>오른쪽에서 채팅방을 선택하세요.</div>;
    }

    return (
        <div className={`${mobileCompact ? 'h-full border-0 rounded-none' : 'h-[420px] border rounded-lg'} bg-white flex flex-col`}>
            {!mobileCompact && (
                <div className="px-3 py-2 border-b text-sm font-semibold text-gray-700">
                    {getChatRoomDisplayTitle(room, myUid, contextData)}
                </div>
            )}
            <div ref={messagesContainerRef} className={`flex-1 min-h-0 overflow-y-auto bg-gray-50 custom-scrollbar mobile-keyboard-messages ${mobileCompact ? 'px-3 py-2 space-y-1.5' : 'p-3 space-y-2'}`}>
                {sortedMessages.length === 0 && <p className="text-xs text-gray-400 whitespace-nowrap">아직 메시지가 없습니다.</p>}
                {renderItems.map((item) => {
                    if (item.type === 'divider') {
                        return (
                            <div key={item.key} className={`flex items-center gap-3 ${mobileCompact ? 'py-0.5' : 'py-1'}`}>
                                <div className="flex-1 h-px bg-gray-200" />
                                <p className="text-xs text-gray-400">{item.label}</p>
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>
                        );
                    }

                    const message = item.message;
                    const mine = String(message.senderId || message.createdBy || '') === String(myUid || '');
                    const isSending = Boolean(message?.sending);
                    const isFailed = Boolean(message?.failed);
                    const senderName = message?.senderName && message.senderName !== '나' ? message.senderName : '메시지';
                    const timeLabel = formatTime(message.createdAt);
                    return (
                        <div key={item.key}>
                            {shouldShowSenderName(room) && !mine && senderName && (
                                <p className="mb-1 text-xs font-semibold text-gray-500">{senderName}</p>
                            )}
                            <div className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                                {mine && <span className="text-[11px] text-gray-400 whitespace-nowrap self-end mb-1">{timeLabel}</span>}
                                <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-[#455fab] text-white' : 'bg-white border border-gray-100 text-gray-900'} ${isSending ? 'opacity-70' : ''} ${isFailed ? 'border border-red-300 bg-red-50 text-red-700' : ''}`}>
                                    {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
                                    {(Array.isArray(message.attachments) ? message.attachments : []).map((attachment) => (
                                        attachment.type === 'image' ? (
                                            <button key={attachment.url || attachment.name} type="button" onClick={() => setImageModal(attachment)} className={`${message.text ? 'mt-2 ' : ''}block text-left`}>
                                                <img src={attachment.url} alt={attachment.name} className="max-h-48 rounded-lg object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                                                <span className="mt-1 block text-xs underline break-all">{attachment.name}</span>
                                            </button>
                                        ) : (
                                            <a key={attachment.url || attachment.name} href={attachment.url} target="_blank" rel="noreferrer" className={`${message.text ? 'mt-2 ' : ''}flex items-center gap-2 rounded-lg border border-current/20 px-2 py-1.5 text-xs`}>
                                                <span>📄</span><span className="break-all">{attachment.name}</span><span className="whitespace-nowrap opacity-75">{formatAttachmentSize(attachment.size)}</span>
                                            </a>
                                        )
                                    ))}
                                    {isSending && <p className="text-[10px] text-gray-500 mt-1">전송 중…</p>}
                                    {isFailed && (
                                        <div className="mt-1 flex items-center justify-end gap-2">
                                            <p className="text-[10px] text-red-500">전송 실패</p>
                                            <button
                                                type="button"
                                                onClick={() => onRetryMessage?.(message)}
                                                className="text-[10px] px-1.5 py-0.5 rounded border border-red-300 text-red-600"
                                            >
                                                재시도
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {!mine && <span className="text-[11px] text-gray-400 whitespace-nowrap self-end mb-1">{timeLabel}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
            {error && <p className="border-t px-3 py-2 text-xs text-red-600">{error}</p>}
            {attachmentFile && (
                <div className="border-t bg-white px-3 py-2 flex items-center gap-3 text-xs">
                    {previewUrl && <img src={previewUrl} alt="첨부 미리보기" className="h-12 w-12 rounded object-cover" />}
                    <span className="flex-1 truncate">{attachmentFile.name} · {formatAttachmentSize(attachmentFile.size)}</span>
                    <button type="button" onClick={clearAttachment} className="text-red-500">취소</button>
                </div>
            )}
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
            <form onSubmit={submit} className={`${mobileCompact ? 'p-2 mobile-keyboard-input-bar gap-1.5 shrink-0' : 'p-2 gap-2 items-end'} border-t bg-white flex`}>
                <label className={`${mobileCompact ? 'px-2.5 py-2 rounded-full text-xs' : 'px-3 py-2 rounded text-sm'} border border-gray-200 bg-white cursor-pointer shrink-0`}>첨부<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" data-camera-disabled="true" onChange={handleAttachmentChange} className="hidden" /></label>
                <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지 입력"
                    rows={mobileCompact ? 1 : 2}
                    className={`${mobileCompact ? 'min-h-10 max-h-24 rounded-full bg-gray-50 px-4 py-2 resize-none' : 'rounded px-3 py-2 resize-y'} flex-1 border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-gray-300`}
                />
                <button type="submit" disabled={!draft.trim() && !attachmentFile} className={`${mobileCompact ? 'px-3 py-2 rounded-full text-xs' : 'px-3 py-2 rounded text-sm'} bg-gray-900 text-white font-semibold disabled:bg-gray-300 shrink-0`}>전송</button>
            </form>
        </div>
    );
}