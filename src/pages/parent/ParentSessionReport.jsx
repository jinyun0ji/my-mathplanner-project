import React from 'react';
import { Icon } from '../../utils/helpers';

export default function ParentSessionReport({ report, onBack }) {
    if (!report) return null;

    // 상태별 색상 매핑 헬퍼
    const getStatusColor = (val) => {
        if (['결석', '미제출', '미응시'].includes(val)) return 'text-red-600 bg-red-50 border-red-100';
        if (['지각', '숙제 출제'].includes(val)) return 'text-orange-600 bg-orange-50 border-orange-100';
        return 'text-indigo-600 bg-indigo-50 border-indigo-100';
    };

    return (
        <div className="animate-fade-in-up pb-20 space-y-6">
            {/* 4-1. 헤더 영역 */}
            <div className="flex items-center gap-3 mb-2">
                <button onClick={onBack} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 active:bg-gray-100 transition-colors shadow-sm">
                    <Icon name="chevronLeft" className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">수업 리포트</h2>
                    <p className="text-xs text-gray-500">{report.date} | {report.className}</p>
                </div>
            </div>

            {/* 4-2. 상단 요약 카드 (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-3">
                <SummaryCard label="출결" value={report.attendance} colorClass={getStatusColor(report.attendance)} icon="user" />
                <SummaryCard label="과제" value={report.homeworkStatus} colorClass={getStatusColor(report.homeworkStatus)} icon="fileText" />
                <SummaryCard label="진도" value={report.progressTopic} colorClass="text-gray-800 bg-white border-gray-200" icon="book" />
                <SummaryCard label="오늘 테스트" value={report.testScore} colorClass={report.testScore === '테스트 없음' ? 'text-gray-400 bg-gray-50' : 'text-blue-600 bg-blue-50 border-blue-100'} icon="edit" />
            </div>

            {/* 5-1. 오늘 수업 내용 */}
            <Section title="오늘 수업 내용">
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    {report.lessonSummary.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                </ul>
            </Section>

            {/* 5-2. 학습 상태 코멘트 */}
            <Section title="학습 상태 코멘트">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {report.learningComment}
                    </p>
                </div>
            </Section>

            {/* 5-3. 다음 과제 안내 (Optional) */}
            {report.homework && (
                <Section title="다음 과제">
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                        <div className="flex items-start gap-3">
                            <div className="bg-white p-2 rounded-lg text-indigo-600 shadow-sm">
                                <Icon name="clipboard" className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-900 text-sm mb-1">{report.homework.description}</h4>
                                <p className="text-xs text-indigo-500">~ {report.homework.dueDate} 까지 제출</p>
                            </div>
                        </div>
                    </div>
                </Section>
            )}

            {/* 5-4. 부모 안내 메시지 (Optional) */}
            {report.parentNote && (
                <Section title="학부모님께">
                    <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 text-sm text-yellow-800 leading-relaxed">
                        <span className="font-bold mr-1">📢</span> {report.parentNote}
                    </div>
                </Section>
            )}
        </div>
    );
}

// 내부 컴포넌트: 요약 카드
const SummaryCard = ({ label, value, colorClass, icon }) => (
    <div className={`p-4 rounded-2xl border flex flex-col justify-center shadow-sm h-24 ${colorClass || 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-1.5 mb-1 opacity-70">
            <Icon name={icon} className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-lg font-extrabold truncate">{value}</span>
    </div>
);

// 내부 컴포넌트: 섹션 래퍼
const Section = ({ title, children }) => (
    <div className="space-y-2">
        <h3 className="text-sm font-bold text-gray-900 px-1">{title}</h3>
        {children}
    </div>
);