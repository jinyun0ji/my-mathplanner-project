import React, { useMemo, useState } from 'react';
import { Icon } from '../../utils/helpers';
import {
    formatNoticeDate,
    getNoticeDateValue,
    getNoticePreviewText,
    sortNoticesForDisplay,
} from '../../utils/notices';

export default function ParentBoardPage({ notices = [], onBack }) {
    const [expandedNoticeId, setExpandedNoticeId] = useState(null);
    const sortedNotices = useMemo(() => sortNoticesForDisplay(notices), [notices]);

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-10 h-10 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm flex items-center justify-center active:scale-95"
                        aria-label="이전 화면으로 돌아가기"
                    >
                        ←
                    </button>
                )}
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900">게시판</h2>
                    <p className="text-xs text-gray-500">학원에서 전달한 안내와 게시글을 확인하세요.</p>
                </div>
            </div>

            {sortedNotices.length > 0 ? (
                <div className="space-y-3">
                    {sortedNotices.map((notice, index) => {
                        const noticeId = notice.id || `${notice.title || 'notice'}-${index}`;
                        const isExpanded = expandedNoticeId === noticeId;
                        return (
                            <article
                                key={noticeId}
                                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3"
                            >
                                <button
                                    type="button"
                                    onClick={() => setExpandedNoticeId(isExpanded ? null : noticeId)}
                                    className="w-full text-left space-y-2"
                                    aria-expanded={isExpanded}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-base font-bold text-gray-900 leading-6 min-w-0">
                                            {notice.title || '제목 없음'}
                                        </h3>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {notice.isPinned && (
                                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500 border border-red-100">
                                                    필독
                                                </span>
                                            )}
                                            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-gray-300" />
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 leading-6 line-clamp-3">
                                        {getNoticePreviewText(notice.content)}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                                        <span className="font-medium text-gray-500">{notice.author || '채수용 수학'}</span>
                                        <span className="w-0.5 h-2 bg-gray-300" />
                                        <span>{formatNoticeDate(getNoticeDateValue(notice))}</span>
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="border-t border-gray-100 pt-3 text-sm text-gray-700 leading-7">
                                        <div dangerouslySetInnerHTML={{ __html: notice.content || '내용이 없습니다.' }} />
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 px-4 text-center text-sm text-gray-500">
                    등록된 게시글이 없습니다.
                </div>
            )}
        </section>
    );
}