import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../utils/helpers';
import { db } from '../firebase/client';
import useAuth from '../auth/useAuth';
import { isStaffOrTeachingRole } from '../constants/roles';
import { fetchStaffTimeline as fetchStaffTimelineThreads } from '../domain/staffTimeline/staffTimeline.service';
import StaffTimelineThreadCard from '../components/StaffTimeline/StaffTimelineThreadCard';
import TodayWorkBriefing from '../components/dashboard/TodayWorkBriefing';
import StaffTasksPanel from '../components/dashboard/StaffTasksPanel';

export default function Home({
    onQuickAction, userRole, classes = [], students = [],
    lessonLogs = [], attendanceLogs = [], lessonReports = [],
}) {
    const { user, userProfile } = useAuth();
    const [staffTimelineItems, setStaffTimelineItems] = useState([]);
    const [staffTimelineLoading, setStaffTimelineLoading] = useState(false);
    const [staffTimelineError, setStaffTimelineError] = useState('');
    const [staffTimelineFilter, setStaffTimelineFilter] = useState('pending');
    const canAccessStaffTimeline = isStaffOrTeachingRole(userRole);
    const fallbackName = userProfile?.email || user?.email ? (userProfile?.email || user?.email).split('@')[0] : '';
    const displayName = userProfile?.displayName?.trim()
        || user?.displayName?.trim()
        || fallbackName
        || '사용자';

    const loadStaffTimeline = useCallback(async () => {
        if (!canAccessStaffTimeline || !db) {
            setStaffTimelineItems([]);
            return;
        }

        setStaffTimelineLoading(true);
        setStaffTimelineError('');

        try {
            const items = await fetchStaffTimelineThreads(db, {
                status: staffTimelineFilter,
                limitCount: 50,
            });
            setStaffTimelineItems(items);
        } catch (error) {
            console.error('[staffTimeline] failed to load items', error);
            setStaffTimelineError('교직원 인수인계를 불러오지 못했습니다.');
            setStaffTimelineItems([]);
        } finally {
            setStaffTimelineLoading(false);
        }
    }, [canAccessStaffTimeline, staffTimelineFilter]);

    useEffect(() => {
        loadStaffTimeline();
    }, [loadStaffTimeline]);

    const timelineGroups = useMemo(() => {
        const groups = new Map();
        staffTimelineItems.forEach((item) => {
            const key = item.studentId || `name:${item.studentName || 'unknown'}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    studentName: item.studentName || '학생명 미상',
                    items: [],
                });
            }
            groups.get(key).items.push(item);
        });
        return Array.from(groups.values());
    }, [staffTimelineItems]);

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
                            {staffTimelineItems.length}건
                        </span>
                    </div>

                    <div className="flex rounded-xl bg-gray-100 p-1" role="group" aria-label="교직원 타임라인 상태 필터">
                        {[
                            { value: 'pending', label: '처리대기' },
                            { value: 'completed', label: '처리완료' },
                            { value: 'all', label: '전체' },
                        ].map((filter) => (
                            <button
                                key={filter.value}
                                type="button"
                                onClick={() => setStaffTimelineFilter(filter.value)}
                                className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${staffTimelineFilter === filter.value ? 'bg-white text-[#334a91] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    {staffTimelineError && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{staffTimelineError}</div>
                    )}

                    {staffTimelineLoading ? (
                        <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">인수인계를 불러오는 중입니다...</div>
                    ) : timelineGroups.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
                            {staffTimelineFilter === 'pending' ? '처리 대기 중인 인수인계가 없습니다.' : '해당 상태의 인수인계가 없습니다.'}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {timelineGroups.map((group) => (
                                <div key={group.key} className="rounded-2xl border border-[#e7ebf8] bg-[#f8f9ff] p-3 sm:p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="font-bold text-gray-900">{group.studentName}</h4>
                                        <span className="text-xs font-semibold text-gray-500">메모 {group.items.length}건</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        {group.items.map((item) => (
                                            <StaffTimelineThreadCard
                                                key={item.id}
                                                thread={item}
                                                actor={timelineActor}
                                                onChanged={loadStaffTimeline}
                                                showStudentName={false}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {canAccessStaffTimeline && <StaffTasksPanel actor={timelineActor} />}

        </div>
    );
}
