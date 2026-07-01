import { EMPTY_ROOM_PREVIEW } from '../constants/messengerConstants';
import { normalizeText } from '../utils/roomMatcher';

const readMessageObjectText = (message) => {
    if (!message || typeof message !== 'object') return '';
    return normalizeText(message.text) || normalizeText(message.content);
};

export const getLastMessagePreviewCandidates = (room) => ({
    lastMessageText: normalizeText(room?.lastMessageText),
    lastMessageTextFromObject: readMessageObjectText(room?.lastMessage),
    lastMessageContentFromObject: room?.lastMessage && typeof room.lastMessage === 'object' ? normalizeText(room.lastMessage.content) : '',
    lastMessage: typeof room?.lastMessage === 'object' ? '' : normalizeText(room?.lastMessage),
    previewText: normalizeText(room?.previewText),
    latestMessageText: normalizeText(room?.latestMessageText),
    lastMessagePreview: normalizeText(room?.lastMessagePreview),
    __previewText: normalizeText(room?.__previewText),
});

export const getLastMessagePreview = (room) => {
    const candidates = getLastMessagePreviewCandidates(room);
    return candidates.lastMessageText
        || candidates.lastMessageTextFromObject
        || candidates.lastMessageContentFromObject
        || candidates.lastMessage
        || candidates.previewText
        || candidates.latestMessageText
        || candidates.lastMessagePreview
        || candidates.__previewText
        || EMPTY_ROOM_PREVIEW;
};
