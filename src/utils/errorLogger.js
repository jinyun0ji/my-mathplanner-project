import { addDoc, collection } from 'firebase/firestore';

import { db } from '../firebase/client';

// 최소한의 안전한 payload만 기록 (PII/민감정보 금지)
export async function logClientError({
    level = 'error',
    scope = 'unknown',
    action = '',
    message = '',
    code = '',
    context = {},
    userId = '',
    userRole = '',
    route = '',
    app = 'web',
    build = '',
}) {
    try {
        const payload = {
            level: level === 'warn' ? 'warn' : 'error',
            scope: String(scope || 'unknown'),
            action: String(action || ''),
            message: String(message || ''),
            code: String(code || ''),
            context: context && typeof context === 'object' ? context : {},
            createdBy: String(userId || ''),
            createdAt: new Date().toISOString(),
            app: String(app || 'web'),
            route: String(route || ''),
            build: String(build || ''),
            userRole: String(userRole || ''),
        };

        if (!payload.createdBy) return;
        await addDoc(collection(db, 'errorLogs'), payload);
    } catch (error) {
        // 로깅 실패는 무시 (무한 루프 방지)
        console.warn('[errorLogs] write failed', error);
    }
}