import { EMPTY_ROOM_PREVIEW } from '../constants/messengerConstants';
import { normalizeText } from '../utils/roomMatcher';

export const getLastMessagePreview = (room) => (
    normalizeText(room?.lastMessageText)
    || normalizeText(room?.lastMessage)
    || normalizeText(room?.message)
    || EMPTY_ROOM_PREVIEW
);
