import React, { useMemo } from 'react';
import { hasClassOnDate } from '../../utils/helpers';
import { isClosedClass, sortClassesWithClosedLast } from '../../utils/classStatus';

const toYmd = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
    const raw = typeof value?.toDate === 'function' ? value.toDate() : value;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const classIdOf = (item) => String(item?.classId || item?.classDocId || item?.class?.id || '');
const dateOf = (item) => toYmd(item?.date || item?.lessonDate || item?.dateKey || item?.createdAt);
const studentClassIds = (student) => (student?.classIds || student?.classes || []).map(String);
const studentIds = (student) => [student?.id, student?.studentUid, student?.authUid, student?.uid].filter(Boolean).map(String);
const attendanceHasStatus = (log) => Boolean(String(log?.status || '').trim());
const reportIsReady = (report) => (
    report?.status === 'sent'
    || report?.sendStatus === 'sent'
    || report?.sendStatus === 'scheduled'
    || Boolean(report?.scheduledSendAt)
);

export default function TodayWorkBriefing({
    classes = [],
    students = [],
    lessonLogs = [],
    attendanceLogs = [],
    lessonReports = [],
    onNavigate,
}) {
    const today = toYmd(new Date());
    const briefing = useMemo(() => sortClassesWithClosedLast(classes)
        .filter((cls) => !isClosedClass(cls) && hasClassOnDate(cls, today))
        .map((cls) => {
            const classId = String(cls.id);
            const roster = students.filter((student) => studentClassIds(student).includes(classId));
            const todayAttendanceIds = new Set(attendanceLogs
                .filter((log) => classIdOf(log) === classId && dateOf(log) === today && attendanceHasStatus(log))
                .flatMap((log) => [log.studentId, log.studentDocId, log.studentUid, log.authUid, log.userId].filter(Boolean).map(String)));
            const missingAttendanceCount = roster.filter((student) => (
                !studentIds(student).some((studentId) => todayAttendanceIds.has(studentId))
            )).length;
            const reports = lessonReports.filter((report) => classIdOf(report) === classId && dateOf(report) === today);
            const reportComplete = roster.length > 0 && roster.every((student) => reports.some((report) => (
                studentIds(student).includes(String(report.studentId || report.studentUid || ''))
                && reportIsReady(report)
            )));
            const lessonLogComplete = lessonLogs.some((log) => classIdOf(log) === classId && dateOf(log) === today);
            return {
                cls,
                required: [
                    {
                        label: lessonLogComplete ? '수업일지 작성 완료' : '수업일지 미작성',
                        complete: lessonLogComplete,
                        page: 'lessons',
                        actionLabel: '수업관리로 이동',
                    },
                    {
                        label: missingAttendanceCount > 0
                            ? `출결 미입력 ${missingAttendanceCount}명`
                            : '출결 입력 완료',
                        complete: roster.length > 0 && missingAttendanceCount === 0,
                        page: 'attendance',
                        actionLabel: '출결관리로 이동',
                    },
                    {
                        label: reportComplete ? '리포트 작성/예약 완료' : '리포트 미작성/미예약',
                        complete: reportComplete,
                        page: 'lessonReports',
                        actionLabel: '수업리포트관리로 이동',
                    },
                ],
            };
        }), [attendanceLogs, classes, lessonLogs, lessonReports, students, today]);

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">오늘 업무 브리핑</h3>
                    <p className="text-xs text-gray-500">{today} 수업 클래스 기준 자동 점검</p>
                </div>
                <span className="rounded-full bg-[#f1f4ff] px-3 py-1 text-xs font-bold text-[#334a91]">{briefing.length}개 클래스</span>
            </div>
            {briefing.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-7 text-center text-sm text-gray-500">오늘 예정된 수업이 없습니다.</div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {briefing.map(({ cls, required }) => (
                        <article key={cls.id} className="rounded-xl border border-gray-200 p-4">
                            <h4 className="font-bold text-gray-900">{cls.name}</h4>
                            <div className="mt-3 space-y-2">
                                {required.map((item) => (
                                    <button key={item.page} type="button" onClick={() => onNavigate?.(item.page)}
                                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${item.complete ? 'border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50' : 'border-rose-200 bg-rose-50 hover:bg-rose-100'}`}>
                                        <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${item.complete ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>{item.complete ? '✓' : '!'}</span>
                                        <span className={`min-w-0 flex-1 ${item.complete ? 'text-emerald-700' : 'font-semibold text-rose-700'}`}>{item.label}</span>
                                        {!item.complete && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">필수 경고</span>}
                                        <span className="text-[11px] font-semibold text-gray-500">{item.actionLabel} →</span>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 border-t pt-3">
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">선택 확인</p>
                                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                    {['성적 입력', '과제 검사', '과제 출제'].map((label) => (
                                        <label key={label} className="flex items-center gap-1.5"><input type="checkbox" />{label}</label>
                                    ))}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
