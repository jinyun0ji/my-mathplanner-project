import React, { useState } from 'react';

export default function ClinicReportCard({ log }) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // 코멘트 길이 체크 (80자 이상이면 접기 처리)
    const isLongComment = log.comment && log.comment.length > 80;
    const displayComment = isExpanded ? log.comment : (isLongComment ? log.comment.slice(0, 80) + '...' : log.comment);

    // 상태 배지 스타일 (임시 로직: '부족' 키워드가 있으면 주황색, 아니면 파란색)
    const isAttentionNeeded = log.comment && log.comment.includes('부족');
    const badgeStyle = isAttentionNeeded 
        ? 'bg-orange-50 text-orange-600 border-orange-100' 
        : 'bg-indigo-50 text-indigo-600 border-indigo-100';
    const statusText = isAttentionNeeded ? '확인 필요' : '작성 완료';

    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm transition-all hover:border-indigo-200">
            {/* 카드 헤더 */}
            <div className="flex justify-between items-start mb-4 border-b border-gray-50 pb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-900 font-bold text-lg">{log.date}</span>
                        <span className="text-gray-400 text-xs font-mono mt-1">
                            {log.checkIn} ~ {log.checkOut || ''}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">{log.tutor || '담당 조교'} 선생님</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${badgeStyle}`}>
                    {statusText}
                </span>
            </div>

            {/* 본문: 학습 내용 및 코멘트 */}
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1">학습 내용</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {log.assignment || '당일 학습 목표 수행 완료'}
                    </p>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1">선생님 코멘트</h4>
                    {log.comment ? (
                        <div className="bg-gray-50 rounded-xl p-3.5">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {displayComment}
                            </p>
                            {isLongComment && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                    className="mt-2 text-xs font-bold text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-indigo-600 transition-colors"
                                >
                                    {isExpanded ? '접기' : '전체 보기'}
                                </button>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 py-2">
                            아직 클리닉 리포트가 작성되지 않았습니다.<br/>작성되는 대로 확인하실 수 있어요.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}