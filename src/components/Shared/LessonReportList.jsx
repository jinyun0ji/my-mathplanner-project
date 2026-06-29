import React from 'react';
import { resolveHomeworkAssignmentTitle } from '../../domain/homework/homework.service';

const toTextLines = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string') return [value];
    if (Array.isArray(value?.text)) return value.text.filter(Boolean).map(String);
    return [];
};

export default function LessonReportList({ reports = [] }) {
    if (!reports.length) {
        return <p className="text-sm text-gray-500">발송된 수업 리포트가 없습니다.</p>;
    }

    return (
        <div className="space-y-3">
            {reports.map((report) => {
                const homeworkLines = toTextLines(report?.homeworkSummary);
                const testLines = toTextLines(report?.testSummary);
                const assignedHomework = Array.isArray(report?.assignedHomeworkSummary?.items)
                    ? report.assignedHomeworkSummary.items
                    : [];
                return (
                    <article key={report.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-500">{report.lessonDate} · {report.className || report.classId}</p>
                            <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">발송됨</span>
                        </div>
                        {report.learnedTopics && <p className="text-sm text-gray-700">진도: {report.learnedTopics}</p>}
                        {report.attendanceStatus && <p className="text-sm text-gray-700">출결: {report.attendanceStatus}</p>}
                        {homeworkLines.length > 0 && <p className="text-sm text-gray-700">과제 수행: {homeworkLines.join(' · ')}</p>}
                        {testLines.length > 0 && (
                            <div className="text-sm text-gray-700">
                                <p className="font-semibold">시험</p>
                                <ul className="list-disc pl-5">
                                    {testLines.map((line, index) => <li key={`test-line-${report.id}-${index}`} className="whitespace-pre-line">{line}</li>)}
                                </ul>
                            </div>
                        )}
                        {assignedHomework.length > 0 && (
                            <p className="text-sm text-gray-700">이번 수업 숙제: {assignedHomework.map((item) => resolveHomeworkAssignmentTitle(item)).join(', ')}</p>
                        )}
                        {report.comment && <p className="text-sm text-[#334a91]">코멘트: {report.comment}</p>}
                    </article>
                );
            })}
        </div>
    );
}