import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase/client';

export const CHAT_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PDF_MAX_BYTES = 10 * 1024 * 1024;

export const formatAttachmentSize = (size = 0) => {
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
    if (size >= 1024) return `${Math.ceil(size / 1024)}KB`;
    return `${size}B`;
};

export const getAttachmentType = (file) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file?.type)) return 'image';
    if (file?.type === 'application/pdf') return 'pdf';
    return '';
};

export const validateChatAttachment = (file) => {
    if (!file) return { ok: false, message: '파일을 선택해주세요.' };
    if (String(file.type || '').startsWith('video/')) return { ok: false, message: '동영상은 첨부할 수 없습니다.' };
    const type = getAttachmentType(file);
    if (!type || !CHAT_ATTACHMENT_TYPES.includes(file.type)) return { ok: false, message: '이미지(JPG/PNG/WebP) 또는 PDF만 첨부할 수 있습니다.' };
    if (type === 'image' && file.size > IMAGE_MAX_BYTES) return { ok: false, message: '이미지 용량은 5MB 이하만 가능합니다.' };
    if (type === 'pdf' && file.size > PDF_MAX_BYTES) return { ok: false, message: 'PDF 용량은 10MB 이하만 가능합니다.' };
    return { ok: true, type };
};

export const safeAttachmentFileName = (name = 'attachment') => String(name)
    .normalize('NFKC')
    .replace(/[\\/#?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'attachment';

export const uploadChatAttachment = async ({ roomId, messageId, file, uploaderUid }) => {
    const validation = validateChatAttachment(file);
    if (!validation.ok) throw new Error(validation.message);
    const safeName = safeAttachmentFileName(file.name);
    const path = `chat-attachments/${roomId}/${messageId}-${safeName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file, {
        contentType: file.type,
        customMetadata: {
            roomId: String(roomId || ''),
            uploaderUid: String(uploaderUid || ''),
            contentType: String(file.type || ''),
            originalName: String(file.name || ''),
        },
    });
    const url = await getDownloadURL(fileRef);
    return {
        type: validation.type,
        name: file.name,
        url,
        path,
        size: file.size,
        contentType: file.type,
    };
};
