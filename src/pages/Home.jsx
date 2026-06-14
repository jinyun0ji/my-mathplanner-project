import React, { useCallback, useMemo, useState } from 'react';
import { Icon } from '../utils/helpers';
import { db } from '../firebase/client';
import useAuth from '../auth/useAuth';
import { isStaffOrTeachingRole } from '../constants/roles';
import { fetchStaffTimelineByStudent } from '../domain/staffTimeline/staffTimeline.service';
import StaffTimelineThreadCard from '../components/StaffTimeline/StaffTimelineThreadCard';
import TodayWorkBriefing from '../components/dashboard/TodayWorkBriefing';
import StaffTasksPanel from '../components/dashboard/StaffTasksPanel';

export default function Home({
    onQuickAction, userRole, classes = [], students = [],
    lessonLogs = [], attendanceLogs = [], lessonReports = [],
}) {
    const { user, userProfile } = useAuth();
    const [selectedTimelineStudentId, setSelectedTimelineStudentId] = useState('');
    const [timelineCache, setTimelineCache] = useState({});
    const [staffTimelineLoading, setStaffTimelineLoading] = useState(false);
    const [staffTimelineError, setStaffTimelineError] = useState('');
    const canAccessStaffTimeline = isStaffOrTeachingRole(userRole);
    const fallbackName = userProfile?.email || user?.email ? (userProfile?.email || user?.email).split('@')[0] : '';
    const displayName = userProfile?.displayName?.trim()
        || user?.displayName?.trim()
        || fallbackName
        || '사용자';

    const loadStaffTimeline = useCallback(async (studentId, force = false) => {
        if (!canAccessStaffTimeline || !db || !studentId) return;
        if (!force && Object.prototype.hasOwnProperty.call(timelineCache, studentId)) return;
        setStaffTimelineLoading(true);
        setStaffTimelineError('');
        try {
            const items = await fetchStaffTimelineByStudent(db, studentId, { limitCount: 20 });
            setTimelineCache((current) => ({ ...current, [studentId]: items }));
        } catch (error) {
            console.error('[staffTimeline] failed to load items', error);
            setStaffTimelineError('교직원 인수인계를 불러오지 못했습니다.');
        } finally {
            setStaffTimelineLoading(false);
        }
    }, [canAccessStaffTimeline, timelineCache]);

    const toggleTimelineStudent = (studentId) => {
        const nextId = selectedTimelineStudentId === studentId ? '' : studentId;
        setSelectedTimelineStudentId(nextId);
        if (nextId) loadStaffTimeline(nextId);
    };

    const timelineActor = useMemo(() => ({
        uid: user?.uid || '',
        name: displayName,
        role: userProfile?.role || userProfile?.type || userRole || 'staff',
    }), [displayName, user?.uid, userProfile?.role, userProfile?.type, userRole]);



    return (
        <div className="space-y-6 lg:space-y-8 pb-2">

            {canAccessStaffTimeline && (
                <>
                    <TodayWorkBriefing
                        classes={classes}
                        students={students}
                        lessonLogs={lessonLogs}
                        attendanceLogs={attendanceLogs}
                        lessonReports={lessonReports}
                        onNavigate={onQuickAction}
                    />
                </>
            )}

            {canAccessStaffTimeline && (
                <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-[#eef2ff] bg-[#f1f4ff] p-2.5 text-[#334a91]">
                                <Icon name="clipboard" className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">학생별 교직원 타임라인</h3>
                                <p className="text-xs text-gray-500">클리닉 맥락과 후속 댓글을 학생별로 이어서 확인합니다.</p>
                            </div>
                        </div>
                        <span className="self-start rounded-full bg-[#f1f4ff] px-3 py-1 text-xs font-bold text-[#334a91] sm:self-auto">
                            학생 {students.length}명
                        </span>
                    </div>

                    {staffTimelineError && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{staffTimelineError}</div>
                    )}

                    {students.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
                            표시할 학생이 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {students.map((student) => {
                                const isOpen = selectedTimelineStudentId === student.id;
                                const items = timelineCache[student.id] || [];
                                return (
                                <div key={student.id} className="rounded-xl border border-gray-200">
                                    <button type="button" onClick={() => toggleTimelineStudent(student.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{student.name || '학생명 미상'}</h4>
                                            <p className="mt-1 text-xs text-gray-500">{student.school || '학교 미등록'} · {student.grade || student.schoolGrade || '학년 미등록'}</p>
                                        </div>
                                        <span className="text-xs font-bold text-[#455fab]">{isOpen ? '접기' : '펼치기'}</span>
                                    </button>
                                    {isOpen && (
                                        <div className="border-t border-gray-100 bg-[#f8f9ff] p-3">
                                            {staffTimelineLoading && !Object.prototype.hasOwnProperty.call(timelineCache, student.id) ? (
                                                <div className="py-5 text-center text-sm text-gray-500">타임라인을 불러오는 중입니다...</div>
                                            ) : items.length ? (
                                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{items.map((item) => (
                                            <StaffTimelineThreadCard
                                                key={item.id}
                                                thread={item}
                                                actor={timelineActor}
                                                onChanged={() => loadStaffTimeline(student.id, true)}
                                                showStudentName={false}
                                            />
                                                ))}</div>
                                            ) : <div className="py-5 text-center text-sm text-gray-500">교직원 타임라인 기록이 없습니다.</div>}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {canAccessStaffTimeline && <StaffTasksPanel actor={timelineActor} />}

        </div>
    );
}
