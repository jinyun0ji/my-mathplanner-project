// src/components/StudentHeader.jsx
import React from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import logoHorizontal from '../assets/logo/logo-horizontal.png';
import { getStudentGradeLabel } from '../utils/gradeUtils';

export default function StudentHeader({
    student,
    onOpenNotifications,
    onOpenMessages,
    hasUnread = false,
}) {
    const profileText = [student?.school, student ? getStudentGradeLabel(student) : ''].filter(Boolean).join(' ');

    return (
        <header className="mobile-header bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm shrink-0">
            <div className="mobile-header-content flex items-center justify-between px-4 py-2 bg-white">
                <div className="flex items-center gap-2 min-w-0 text-brand-dark">
                    <img
                        src={logoHorizontal}
                        alt="채수용 수학"
                        className="h-8 w-auto max-w-[132px] object-contain shrink-0"
                    />
                    <div className="min-w-0">
                        <h1 className="sr-only">채수용 수학</h1>
                        <p className="text-xs text-gray-500 truncate">{student?.name || '학생'}{profileText ? ` · ${profileText}` : ''}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onOpenNotifications}
                        className="relative min-w-11 min-h-11 p-2 rounded-lg border border-gray-200 text-gray-600 active:scale-95 hover:bg-gray-50"
                        aria-label="알림센터 열기"
                    >
                        <NotificationsIcon style={{ fontSize: 20 }} />
                        {hasUnread && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenMessages}
                        className="relative min-w-11 min-h-11 p-2 rounded-lg border border-gray-200 text-gray-600 active:scale-95 hover:bg-gray-50"
                        aria-label="메시지 열기"
                    >
                        <ChatBubbleOutlineIcon style={{ fontSize: 20 }} />
                    </button>
                </div>
            </div>
        </header>
    );
}
