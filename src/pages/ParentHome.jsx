import { resolveHomeworkAssignmentTitle } from '../domain/homework/homework.service';
// src/pages/ParentHome.jsx
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScheduleTab } from '../components/StudentTabs';
import { doc, getDoc } from 'firebase/firestore';
import ParentClassroomView from './parent/ParentClassroomView';
import {
    Icon,
    calculateHomeworkStats,
    calculateGradeComparison,
    getClinicComment,
    getClinicDisplayStatus,
    calculateDurationMinutes,
    formatDuration,
} from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ParentSessionReport from './parent/ParentSessionReport'; // ✅ 신규 리포트 컴포넌트
import ParentMessengerPage from './parent/ParentMessengerPage';
import ParentBoardPage from './parent/ParentBoardPage';
import ParentMorePage from './parent/ParentMorePage';
import { generateSessionReport } from '../utils/reportHelper'; // ✅ 리포트 데이터 생성 헬퍼
import useNotifications from '../notifications/useNotifications';
import NotificationList from '../notifications/NotificationList';
import openNotification from '../notifications/openNotification';
import { markAllNotificationsRead, markNotificationRead } from '../notifications/notificationReadActions';
import { useParentContext } from '../parent';
import { sortClassesByStatus, getViewerVisibleClassIds } from '../utils/classStatus';
import { formatNoticeDate, getNoticeDateValue, getNoticePreviewText, sortNoticesForDisplay } from '../utils/notices';
import { auth, db } from '../firebase/client';
import { formatStudentScore, formatTestStatsInline, getTestStatsForDisplay } from '../utils/scoreDisplay';
import { getViewerTodayClassItems, toLocalYmd } from '../utils/viewerTodaySchedule';
import { FEATURES } from '../config/features';
import MathText from '../components/common/MathText';
import logoHorizontal from '../assets/logo/logo-horizontal.png';
import { getStudentGradeLabel } from '../utils/gradeUtils';


const getItemClassId = (item) => (
    item?.classId
    || item?.classDocId
    || item?.classID
    || item?.class?.id
    || item?.class?.classId
    || item?.class?.docId
    || item?.class?.classDocId
    || item?.classRef
    || item?.class?.ref
    || ''
);


const normalizeViewerClassStatus = (value) => {
    if (value === 'withdrawn') return '퇴원';
    if (value === 'active') return '진행중';
    if (value === '재원') return '진행중';
    return value;
};

const isViewerWithdrawnStatus = (value) => {
    const normalized = normalizeViewerClassStatus(value);
    return ['퇴원', '중도퇴원', '전반', '전반퇴원'].includes(normalized);
};

const toDayStartMs = (value) => {
    const date = value ? new Date(value) : new Date();
    const time = Number.isNaN(date.getTime()) ? new Date() : date;
    return new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
};

const shouldHideTodayItemByExit = (item, exitMap) => {
    const classId = String(getItemClassId(item) || item?.classId || '');
    const classCode = String(item?.classCode || item?.classKey || item?.code || '');
    if (!classId && !classCode) return false;
    const exit = exitMap?.[classId] || (classCode ? exitMap?.[classCode] : null);
    if (!exit) return false;
    if (!isViewerWithdrawnStatus(exit.status)) return false;
    if (!exit.exitAtMs) return true;
    const itemDayMs = toDayStartMs(item?.date || new Date());
    const exitDayMs = toDayStartMs(exit.exitAtMs);
    return itemDayMs >= exitDayMs;
};

const buildStudentClassStatusMap = (child) => {
    if (!child) return {};
    const normalizeStatusValue = (value) => {
        if (value && typeof value === 'object') {
            return value?.status || value?.classStatus || '';
        }
        return value ?? '';
    };

    if (child.classStatusMap && typeof child.classStatusMap === 'object') {
        const map = {};
        Object.entries(child.classStatusMap).forEach(([key, value]) => {
            const status = normalizeStatusValue(value);
            if (status) map[String(key)] = status;
        });
        return map;
    }

    if (child.classStatusByClassId && typeof child.classStatusByClassId === 'object') {
        const map = {};
        Object.entries(child.classStatusByClassId).forEach(([key, value]) => {
            const status = normalizeStatusValue(value);
            if (status) map[String(key)] = status;
        });
        return map;
    }

    const list =
        (Array.isArray(child?.classStatuses) && child.classStatuses)
        || (Array.isArray(child?.enrollments) && child.enrollments)
        || (Array.isArray(child?.classEnrollments) && child.classEnrollments)
        || (Array.isArray(child?.classesMeta) && child.classesMeta)
        || (Array.isArray(child?.classes) && child.classes)
        || [];

        const mapLike =
        child?.classStatusMap
        || child?.studentClassStatusMap
        || child?.enrollmentMap
        || null;

    const listFromMap = [];
    if (mapLike && typeof mapLike === 'object') {
        for (const [key, value] of Object.entries(mapLike)) {
            if (value && typeof value === 'object') listFromMap.push({ classId: key, ...value });
            else listFromMap.push({ classId: key, status: value });
        }
    }

    const merged = [...list, ...listFromMap];

    const map = {};
    for (const item of merged) {
        const cid = String(item?.classId || item?.id || '');
        const st = item?.status || item?.classStatus || '';
        if (cid) map[cid] = st;
    }
    return map;
};

const buildChildClassExitMap = (child) => {
    if (!child) return {};
    if (child.classExitMap && typeof child.classExitMap === 'object') return child.classExitMap;

    const list =
        (Array.isArray(child?.classStatuses) && child.classStatuses)
        || (Array.isArray(child?.enrollments) && child.enrollments)
        || (Array.isArray(child?.classEnrollments) && child.classEnrollments)
        || (Array.isArray(child?.classesMeta) && child.classesMeta)
        || (Array.isArray(child?.classes) && child.classes)
        || [];

    const mapLike =
        child?.classStatusMap
        || child?.studentClassStatusMap
        || child?.enrollmentMap
        || null;

    const listFromMap = [];
    if (mapLike && typeof mapLike === 'object') {
        for (const [key, value] of Object.entries(mapLike)) {
            if (value && typeof value === 'object') listFromMap.push({ classId: key, ...value });
            else listFromMap.push({ classId: key, status: value });
        }
    }

    const merged = [...list, ...listFromMap];

    const toMs = (value) => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    };

    const map = {};
    for (const item of merged) {
        const rawDocId =
            item?.classDocId
            || item?.classDocumentId
            || item?.classRefId
            || item?.docId
            || item?.id
            || null;

        const rawCode =
            item?.classId
            || item?.classCode
            || item?.code
            || item?.classKey
            || null;

        const status = String(item?.status || item?.classStatus || '').trim();

        const raw =
            item?.withdrawAt
            || item?.withdrawDate
            || item?.leftAt
            || item?.leftDate
            || item?.exitedAt
            || item?.exitDate
            || item?.endedAt
            || item?.updatedAt
            || null;

        const entry = { status, exitAtMs: toMs(raw) };

        if (rawDocId) map[String(rawDocId)] = entry;
        if (rawCode) map[String(rawCode)] = entry;

        const fallback = String(rawDocId || rawCode || '');
        if (fallback) map[fallback] = entry;
    }
    return map;
};

const buildExitMapFromClasses = (classesList, studentId) => {
    const list = Array.isArray(classesList) ? classesList : [];
    const sid = String(studentId || '');
    if (!sid) return {};

    const toMs = (value) => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    };

    const map = {};

    const normalize = (statusValue) => String(statusValue || '').trim();

    const pickEnrollment = (classItem) => {
        const mapCandidate =
            classItem?.studentStatusMap
            || classItem?.studentStatusesMap
            || classItem?.classStatusMap
            || classItem?.enrollmentMap
            || null;

        if (mapCandidate && typeof mapCandidate === 'object') {
            const value = mapCandidate[sid] || mapCandidate[String(sid)];
            if (value) return value;
        }

        const listCandidate =
            classItem?.studentStatuses
            || classItem?.enrollments
            || classItem?.classEnrollments
            || classItem?.studentsMeta
            || null;

        if (Array.isArray(listCandidate)) {
            return listCandidate.find((entry) =>
                String(entry?.studentId || entry?.sid || entry?.id || entry?.uid || '') === sid,
            ) || null;
        }

        return null;
    };

    for (const classItem of list) {
        const classDocId = String(classItem?.id || classItem?.classDocId || classItem?.classDocumentId || '');
        if (!classDocId) continue;

        const enrollment = pickEnrollment(classItem);
        if (!enrollment) continue;

        const status = normalize(enrollment?.status || enrollment?.classStatus || enrollment);

        const raw =
            enrollment?.withdrawAt
            || enrollment?.withdrawDate
            || enrollment?.leftAt
            || enrollment?.leftDate
            || enrollment?.endedAt
            || enrollment?.updatedAt
            || null;

        map[classDocId] = { status, exitAtMs: toMs(raw) };
    }

    return map;
};


// --- [컴포넌트] 학부모 전용 대시보드 ---
const ParentDashboard = ({
    child, myClasses, attendanceLogs, homeworkStats,
    gradeComparison, clinicLogs, unpaidPayments,
    setActiveTab,
    childClassExitMap,
    activeChildId,
    closures,
}) => {
    const today = new Date();
    const todayStr = toLocalYmd(today);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDayName = dayNames[today.getDay()];

    // 1. 상태 계산 로직
    const statusData = useMemo(() => {
        // [출결] 최근 4회 기준
        const recentLogs = attendanceLogs
            .filter(l => l.studentId === child.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 4);
        const presentCount = recentLogs.filter(l => ['출석', '동영상보강'].includes(l.status)).length;
        const attendRate = recentLogs.length > 0 ? (presentCount / recentLogs.length) * 100 : 100;
        
        let attendStatus = { color: 'bg-[#f1f4ff] text-[#334a91] border-[#eef2ff]', label: '정상', icon: 'check' };
        if (attendRate < 50) attendStatus = { color: 'bg-red-50 text-red-700 border-red-100', label: '주의 필요', icon: 'alertCircle' };
        else if (attendRate < 80) attendStatus = { color: 'bg-orange-50 text-orange-700 border-orange-100', label: '확인 요망', icon: 'alertCircle' };

        // [과제] 미제출 건수 기준
        const pendingCount = homeworkStats.filter(h => !h.isComplete).length;
        let hwStatus = { color: 'bg-[#f1f4ff] text-[#334a91] border-[#eef2ff]', label: '양호' };
        if (pendingCount >= 5) hwStatus = { color: 'bg-red-50 text-red-700 border-red-100', label: '제출 지연' };
        else if (pendingCount >= 3) hwStatus = { color: 'bg-orange-50 text-orange-700 border-orange-100', label: '확인 필요' };

        // [성적] 직전 시험 대비 추이
        let gradeStatus = { color: 'bg-gray-50 text-gray-600 border-gray-200', label: '데이터 없음' };
        if (gradeComparison && gradeComparison.length >= 2) {
            const sorted = [...gradeComparison].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
            const latest = sorted[sorted.length - 1];
            const prev = sorted[sorted.length - 2];
            const latestScore = Number.isFinite(latest.studentScore) ? latest.studentScore : null;
            const prevScore = Number.isFinite(prev.studentScore) ? prev.studentScore : null;

            if (latestScore !== null && prevScore !== null) {
                if (latestScore > prevScore) gradeStatus = { color: 'bg-blue-50 text-[#334a91] border-blue-100', label: '상승세' };
                else if (latestScore < prevScore) gradeStatus = { color: 'bg-orange-50 text-orange-700 border-orange-100', label: '하락세' };
                else gradeStatus = { color: 'bg-gray-50 text-gray-700 border-gray-200', label: '유지' };
            }
        }

        return { attend: attendStatus, hw: hwStatus, grade: gradeStatus };
    }, [attendanceLogs, homeworkStats, gradeComparison, child.id]);
    
    // 2. 오늘의 수업 요약
    const buildClinicTeacher = (log) => log?.tutorName || log?.tutor || log?.teacherName || log?.teacher || '-';
    const formatClinicTime = (log) => {
        const plannedStart = typeof log?.plannedTime === 'string' ? log.plannedTime : log?.plannedTime?.start;
        const plannedEnd = typeof log?.plannedTime === 'string' ? '' : log?.plannedTime?.end;
        const start = log?.checkIn || plannedStart || '';
        const end = log?.checkOut || plannedEnd || '';
        if (start && end) return `${start} ~ ${end}`;
        if (start) return `${start} 예정`;
        return '시간 미정';
    };
    const buildClinicStatus = (log) => {
        if (log?.checkOut) return '완료';
        if (log?.checkIn || log?.plannedTime) return '예약됨';
        return '예정';
    };
    const todayItems = useMemo(() => {
        const todayClinicSchedules = (Array.isArray(clinicLogs) ? clinicLogs : [])
            .filter((l) => l.studentId === child.id && l.date === todayStr)
            .map((l) => ({
                type: 'clinic',
                time: l.checkIn || (typeof l?.plannedTime === 'string' ? l.plannedTime : l.plannedTime?.start) || '99:99',
                timeLabel: formatClinicTime(l),
                title: '클리닉',
                sub: `선생님: ${buildClinicTeacher(l)} • ${buildClinicStatus(l)}`,
                date: l.date,
            }));

        const todaysClasses = getViewerTodayClassItems({
            classes: myClasses,
            date: today,
            dateStr: todayStr,
            closures,
            isClassRetiredOnDate: (classId, dateValue) => shouldHideTodayItemByExit({ classId, date: dateValue }, childClassExitMap),
        });

        const merged = [
            ...todaysClasses,
            ...todayClinicSchedules,
        ].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
        console.log('[parent][today] home count', { count: merged.length, classCount: todaysClasses.length, todayStr });
        return merged;
    }, [child, childClassExitMap, clinicLogs, myClasses, today, todayStr, closures]);
    const filteredTodayItems = useMemo(() => {
        const list = Array.isArray(todayItems) ? todayItems : [];
        return list.filter((item) => !shouldHideTodayItemByExit(item, childClassExitMap));
    }, [todayItems, childClassExitMap]);

    // 3. 확인 필요 항목 (Action Items)
    const actionItems = [];
    if (statusData.attend.label !== '정상') {
        actionItems.push({ id: 'att', type: 'warning', text: '최근 출결 상태 확인이 필요합니다.', link: 'report' });
    }
    if (statusData.hw.label === '제출 지연') {
        actionItems.push({ id: 'hw', type: 'warning', text: '장기 미제출 과제가 확인되었습니다.', link: 'report' });
    }

    return (
        <div className="space-y-3 animate-fade-in-up">
            {/* 1. 상단 상태 요약 카드 */}
            {false && (
                <section>
                    <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">학습 상태 요약</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div onClick={() => setActiveTab('report')} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm cursor-pointer active:scale-95 transition-all ${statusData.attend.color}`}>
                            <div className="mb-2 opacity-80"><Icon name="user" className="w-6 h-6" /></div>
                            <span className="text-xs font-medium opacity-70 mb-0.5">최근 출결</span>
                            <span className="text-lg font-extrabold">{statusData.attend.label}</span>
                        </div>
                        <div onClick={() => setActiveTab('report')} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm cursor-pointer active:scale-95 transition-all ${statusData.hw.color}`}>
                            <div className="mb-2 opacity-80"><Icon name="fileText" className="w-6 h-6" /></div>
                            <span className="text-xs font-medium opacity-70 mb-0.5">과제 수행</span>
                            <span className="text-lg font-extrabold">{statusData.hw.label}</span>
                        </div>
                        <div onClick={() => setActiveTab('report')} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm cursor-pointer active:scale-95 transition-all ${statusData.grade.color}`}>
                            <div className="mb-2 opacity-80"><Icon name="trendingUp" className="w-6 h-6" /></div>
                            <span className="text-xs font-medium opacity-70 mb-0.5">성적 추이</span>
                            <span className="text-lg font-extrabold">{statusData.grade.label}</span>
                        </div>
                    </div>
                </section>
            )}

            {/* 2. 중단 오늘의 수업 */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Icon name="calendar" className="w-4 h-4 text-[#455fab]" />
                        오늘의 수업 ({filteredTodayItems.length})
                    </h3>
                    <span className="text-xs text-gray-500">{today.getMonth() + 1}월 {today.getDate()}일 ({todayDayName})</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredTodayItems.length > 0 ? (
                        filteredTodayItems.map((item, idx) => (
                             <div key={idx} className="flex items-center gap-3 p-3 hover:bg-[#f1f4ff] rounded-xl transition-colors border border-gray-100">
                                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{item.time}</span>
                                <div>
                                    <div className="font-bold text-gray-900 text-sm">{item.title} {item.timeLabel ? `(${item.timeLabel})` : ''}</div>
                                    <div className="text-xs text-gray-500">{item.sub}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center text-gray-400 text-xs sm:col-span-2">
                            예정된 학원 일정이 없습니다.
                        </div>
                    )}
                </div>
            </section>

            {/* 3. 하단 확인 필요 항목 (조건부 노출) */}
            {false && actionItems.length > 0 && (
                <section className="animate-fade-in">
                    <h3 className="text-sm font-bold text-red-600 mb-2 px-1 flex items-center gap-1">
                        <Icon name="alertCircle" className="w-4 h-4" /> 확인이 필요합니다
                    </h3>
                    <div className="space-y-2">
                        {actionItems.map((item) => (
                            <div 
                                key={item.id} 
                                onClick={() => setActiveTab(item.link)}
                                className={`p-4 rounded-xl border flex justify-between items-center cursor-pointer shadow-sm active:scale-[0.98] transition-transform ${
                                    item.type === 'danger' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'
                                }`}
                            >
                                <span className={`text-sm font-bold ${
                                    item.type === 'danger' ? 'text-red-700' : 'text-orange-700'
                                }`}>{item.text}</span>
                                <Icon name="chevronRight" className={`w-4 h-4 ${
                                    item.type === 'danger' ? 'text-red-300' : 'text-orange-300'
                                }`} />
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

// --- 메인 페이지 컴포넌트 ---
export default function ParentHome({
    userId, students, parents = [], classes, homeworkAssignments, homeworkResults,
    attendanceLogs, lessonLogs, notices, tests, grades, classTestStats,
    videoProgress, clinicLogs, lessonReports = [], onLogout,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    closures,
    masterView = false,
    masterViewStudentId = '',
    masterViewStudentAuthUid = '',
    readOnly = false,
    embedded = false,
}) {
    const { activeStudentId, studentIds, setActiveStudentId } = useParentContext();
    // 1. 자녀 데이터 및 선택 로직
    const initialStudent = students.find(s => s.id === activeStudentId);
    const [activeChildId, setActiveChildId] = useState(activeStudentId);
    const [linkedParentDocId, setLinkedParentDocId] = useState('');
    const pendingStudentSwitchRef = useRef(null);
    const activeChild = students.find(s => s.id === activeChildId) || initialStudent;
    const activeChildName = activeChild?.name || '학생';
    const activeChildSchool = activeChild?.school || '학교 정보 없음';
    const activeChildGrade = getStudentGradeLabel(activeChild);
    // 2. 데이터 필터링
    const rawMyClasses = useMemo(() => {
        if (!Array.isArray(classes) || !activeChildId) return [];
        const childClassIds = new Set([
            ...(Array.isArray(activeChild?.classIds) ? activeChild.classIds : []),
            ...(Array.isArray(activeChild?.classes) ? activeChild.classes.filter((item) => typeof item === 'string') : []),
        ].map(String));
        return classes.filter((c) => {
            const classId = String(c?.id || c?.classId || '');
            return (c.students || []).includes(activeChildId) || childClassIds.has(classId);
        });
    }, [classes, activeChildId, activeChild?.classIds, activeChild?.classes]);
    const visibleClassIds = useMemo(() => getViewerVisibleClassIds(rawMyClasses, activeChild), [rawMyClasses, activeChild]);
    const visibleClassIdSet = useMemo(() => new Set(visibleClassIds), [visibleClassIds]);
    const myClasses = useMemo(
        () => rawMyClasses.filter((cls) => visibleClassIdSet.has(String(cls?.id || cls?.classId || ''))),
        [rawMyClasses, visibleClassIdSet],
    );
    const isVisibleClassItem = useCallback((item) => {
        const classId = String(getItemClassId(item) || '');
        return Boolean(classId && visibleClassIdSet.has(classId));
    }, [visibleClassIdSet]);
    const filteredLessonLogs = useMemo(() => {
        if (!Array.isArray(lessonLogs)) return [];
        return lessonLogs.filter((log) => isVisibleClassItem(log));
    }, [lessonLogs, isVisibleClassItem]);
    const filteredTests = useMemo(() => {
        if (!Array.isArray(tests)) return [];
        return tests.filter((test) => isVisibleClassItem(test));
    }, [tests, isVisibleClassItem]);
    const filteredHomeworkAssignments = useMemo(() => {
        if (!Array.isArray(homeworkAssignments)) return [];
        return homeworkAssignments.filter((assignment) => isVisibleClassItem(assignment));
    }, [homeworkAssignments, isVisibleClassItem]);
    const filteredAttendanceLogs = useMemo(() => {
        if (!Array.isArray(attendanceLogs)) return [];
        return attendanceLogs.filter((log) => isVisibleClassItem(log));
    }, [attendanceLogs, isVisibleClassItem]);
    const filteredVideoProgress = useMemo(() => {
        if (!Array.isArray(videoProgress)) return videoProgress;
        return videoProgress.filter((item) => isVisibleClassItem(item));
    }, [videoProgress, isVisibleClassItem]);

    const studentClassStatusMap = useMemo(
        () => buildStudentClassStatusMap(activeChild),
        [activeChild],
    );
    const childClassExitMap = useMemo(() => {
        const fromChild = buildChildClassExitMap(activeChild);
        if (fromChild && Object.keys(fromChild).length > 0) return fromChild;

        const fromClasses = buildExitMapFromClasses(classes, activeChildId);

        return fromClasses || {};
    }, [activeChild, classes, activeChildId]);

    useEffect(() => {
        console.log('[parent][today] activeChild=', activeChild);
        console.log('[parent][today] childClassExitMap keys=', Object.keys(childClassExitMap || {}));
    }, [activeChild, childClassExitMap]);

    useEffect(() => {
        console.log('[parent] activeChild=', activeChild);
    }, [activeChild]);

    // ✅ 변경: 진행중/종강/퇴원 분리 + 모두 사용
    const {
        ongoing: ongoingClasses,
        finished: finishedClasses,
        withdrawn: withdrawnClasses,
        ordered: orderedClasses,
    } = useMemo(
        () => sortClassesByStatus(myClasses, studentClassStatusMap, childClassExitMap),
        [myClasses, studentClassStatusMap, childClassExitMap],
    );

    const myHomeworkStats = useMemo(
        () => calculateHomeworkStats(
            activeChildId,
            filteredHomeworkAssignments,
            homeworkResults,
            { activeViewerAuthUid: activeChild?.authUid, studentAuthUid: activeChild?.authUid, activeStudentId: activeChildId, students },
        ),
        [activeChild?.authUid, activeChildId, filteredHomeworkAssignments, homeworkResults, students],
    );
    const myGradeComparison = useMemo(() => calculateGradeComparison(activeChildId, classes, filteredTests, grades, classTestStats), [activeChildId, classes, filteredTests, grades, classTestStats]);
    const unpaidPayments = [];

    // 3. 상태 관리
    // ✅ 탭/상세 상태를 URL(querystring)에 동기화해서 "뒤로가기"가 탭 전환으로 동작하게 함
    const [searchParams, setSearchParams] = useSearchParams();

    const readTabFromUrl = () => searchParams.get('tab') || 'home';
    const readClassroomFromUrl = () => searchParams.get('classroomId');
    const readReportFromUrl = () => searchParams.get('reportId');

    const [activeTab, _setActiveTab] = useState(readTabFromUrl());
    const [selectedClassroomId, _setSelectedClassroomId] = useState(readClassroomFromUrl());
    // ✅ 리포트 뷰 상태
    const [learningMode, setLearningMode] = useState('regular'); // 'regular' | 'clinic'
    const [learningSubTab, setLearningSubTab] = useState('homework');
    const [expandedHomeworkDetails, setExpandedHomeworkDetails] = useState({});
    const [classFilter, setClassFilter] = useState('ongoing'); // 기본: 진행중
    const [selectedReportId, _setSelectedReportId] = useState(readReportFromUrl());
    const [boardBackTab, setBoardBackTab] = useState('home');
    const [moreView, setMoreView] = useState('menu');

    // ✅ URL -> state (브라우저 뒤로/앞으로로 URL이 바뀌면 화면도 따라감)
    useEffect(() => {
        const nextTab = readTabFromUrl();
        const nextClassroomId = readClassroomFromUrl();
        const nextReportId = readReportFromUrl();

        if (nextTab !== activeTab) _setActiveTab(nextTab);
        if ((nextClassroomId || null) !== (selectedClassroomId || null)) _setSelectedClassroomId(nextClassroomId || null);
        if ((nextReportId || null) !== (selectedReportId || null)) _setSelectedReportId(nextReportId || null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // ✅ state -> URL (앱 내부 동작은 아래 래퍼 함수를 통해서만 변경)
    const setActiveTab = useCallback((tab, { replace = false } = {}) => {
        _setActiveTab(tab);
        requestAnimationFrame(() => {
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            if (!embedded) window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        if (embedded) return;
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);

            // 탭 이동 시, 상세 화면 파라미터 정리 (정책: report 탭이 아니면 상세 파라미터 제거)
            if (tab !== 'report') {
                next.delete('reportId');
                next.delete('classroomId');
            }
            return next;
        }, { replace });
    }, [setSearchParams, embedded]);

    const setSelectedClassroomId = useCallback((classId, { replace = false } = {}) => {
        const value = classId === null || classId === undefined || classId === '' ? null : String(classId);
        _setSelectedClassroomId(value);
        // classroom 선택은 report 탭 컨텍스트
        if (value) _setActiveTab('report');
        if (embedded) return;

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) {
                next.set('tab', 'report');
                next.set('classroomId', value);
                next.delete('reportId');
            } else {
                next.delete('classroomId');
            }
            return next;
        }, { replace });
    }, [setSearchParams, embedded]);

    const setSelectedReportId = useCallback((reportId, { replace = false } = {}) => {
        const value = reportId === null || reportId === undefined || reportId === '' ? null : String(reportId);
        _setSelectedReportId(value);
        // report 선택은 report 탭 컨텍스트
        if (value) _setActiveTab('report');
        if (embedded) return;

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) {
                next.set('tab', 'report');
                next.set('reportId', value);
                next.delete('classroomId');
            } else {
                next.delete('reportId');
            }
            return next;
        }, { replace });
    }, [setSearchParams, embedded]);

    
    const mainScrollRef = useRef(null);
    const learningSectionRefs = useRef({ homework: null, grades: null, attendance: null, clinic: null });

    const [clinicPageSize, setClinicPageSize] = useState(3);
    const [lessonReportClassFilter, setLessonReportClassFilter] = useState('all');
    const [showAllLessonReports, setShowAllLessonReports] = useState(false);


    const waitForActiveStudentSwitch = useCallback((studentId) => {
        if (!studentId || studentId === activeStudentId) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            pendingStudentSwitchRef.current = { studentId, resolve };
        });
    }, [activeStudentId]);

    useEffect(() => {
        const pending = pendingStudentSwitchRef.current;
        if (!pending || pending.studentId !== activeStudentId) {
            return;
        }

        pending.resolve();
        pendingStudentSwitchRef.current = null;
    }, [activeStudentId]);

    const previousActiveStudentIdRef = useRef(activeStudentId);

    useEffect(() => {
        if (previousActiveStudentIdRef.current === activeStudentId) {
            setActiveChildId(activeStudentId);
            return;
        }

        previousActiveStudentIdRef.current = activeStudentId;
        setActiveChildId(activeStudentId);
        _setSelectedClassroomId(null);
        _setSelectedReportId(null);
        setClassFilter('ongoing');
        _setActiveTab('home');
        setClinicPageSize(3);
        if (embedded) return;
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'home');
            next.delete('classroomId');
            next.delete('reportId');
            return next;
        }, { replace: true });
    }, [activeStudentId, setSearchParams, embedded]);

    // 알림 관련
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isMessengerPage, setIsMessengerPage] = useState(false);
    const [initialMessengerRoomId, setInitialMessengerRoomId] = useState('');
    const currentAuthUid = auth.currentUser?.uid || '';

    useEffect(() => {
        if (!currentAuthUid || !db) {
            setLinkedParentDocId('');
            return undefined;
        }

        let isMounted = true;

        getDoc(doc(db, 'userAuthIndex', currentAuthUid))
            .then((snapshot) => {
                if (!isMounted) return;
                const userDocId = snapshot.exists() ? snapshot.data()?.userDocId : '';
                setLinkedParentDocId(userDocId ? String(userDocId).trim() : '');
            })
            .catch((error) => {
                if (!isMounted) return;
                console.warn('[parent auth index] failed to load linked parent doc id', error);
                setLinkedParentDocId('');
            });

        return () => {
            isMounted = false;
        };
    }, [currentAuthUid]);

    useEffect(() => {
        if (activeTab === 'more') {
            setMoreView('menu');
        }
    }, [activeTab]);
    const isMasterPreview = Boolean(masterView);
    const showMasterViewUnavailable = useCallback((featureName) => {
        window.alert(`마스터뷰에서는 ${featureName}을(를) 사용할 수 없습니다.`);
    }, []);

    const currentParent = useMemo(() => {
        const currentUser = auth.currentUser;
        const identifiers = [userId, currentUser?.uid, currentUser?.email, linkedParentDocId]
            .filter(Boolean)
            .map((value) => String(value).trim().toLowerCase())
            .filter(Boolean);

        if (!Array.isArray(parents) || identifiers.length === 0) return null;

        return parents.find((parent) => {
            const parentIdentifiers = [parent?.authUid, parent?.uid, parent?.id, parent?.email]
                .filter(Boolean)
                .map((value) => String(value).trim().toLowerCase())
                .filter(Boolean);

            return parentIdentifiers.some((value) => identifiers.includes(value));
        }) || null;
    }, [parents, userId, linkedParentDocId]);

    const parentNotificationUid = isMasterPreview
        ? (currentParent?.authUid || currentParent?.uid || linkedParentDocId || userId || '')
        : (currentParent?.authUid || currentParent?.uid || linkedParentDocId || currentAuthUid || userId || '');

    console.log('[notifications uid]', {
        role: 'parent',
        authUid: auth.currentUser?.uid || '',
        linkedUserDocId: linkedParentDocId,
        notificationViewerUid: parentNotificationUid,
    });

    const notificationViewerUid = parentNotificationUid;

    const { notifications, hasUnread, unreadCount, lastReadAt, isLoading, isMetaLoading, setNotifications } = useNotifications(notificationViewerUid, 20, {
        viewerRole: 'parent',
        unreadOnly: true,
    });

    const buildClinicTeacher = useCallback((log) => (
        log?.tutorName
        || log?.tutor
        || log?.assistantName
        || log?.assistant
        || log?.teacherName
        || log?.teacher
        || log?.updatedByName
        || log?.createdByName
        || '-'
    ), []);

    const buildClinicComment = useCallback((log) => getClinicComment(log), []);

    const getParentClinicStatusStyle = useCallback((status) => {
        if (status === '미참석') return 'bg-rose-50 text-rose-700 border-rose-200';
        if (status === '완료' || status === '참석') return 'bg-teal-50 text-teal-700 border-teal-200';
        if (status === '예약됨' || status === '입실 예정') return 'bg-sky-50 text-sky-700 border-sky-200';
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }, [setActiveTab]);

    const formatClinicTimeLabel = useCallback((log) => {
        const plannedStart = typeof log?.plannedTime === 'string' ? log?.plannedTime : log?.plannedTime?.start;
        const plannedEnd = typeof log?.plannedTime === 'object' ? log?.plannedTime?.end : '';
        const start = log?.checkIn || plannedStart || '';
        const end = log?.checkOut || plannedEnd || '';
        if (start && end) return `${start} ~ ${end}`;
        if (start) return `${start}`;
        if (log?.timeSlot) return String(log.timeSlot);
        if (typeof log?.plannedTime === 'string' && log?.plannedTime) return log.plannedTime;
        return '시간 미정';
    }, [setActiveTab]);

    const myClinicLogs = useMemo(() => {
        if (!Array.isArray(clinicLogs) || !activeChildId) return [];
        return clinicLogs
            .filter((log) => log?.studentId === activeChildId)
            .map((log) => ({
                ...log,
                teacherResolved: buildClinicTeacher(log),
                commentResolved: buildClinicComment(log),
                displayStatus: getClinicDisplayStatus(log),
            }));
    }, [clinicLogs, activeChildId, buildClinicComment, buildClinicTeacher]);

    const completedClinics = useMemo(() => {
        return myClinicLogs
            .filter((log) => log?.displayStatus !== '예약됨')
            .sort((a, b) => {
                const aTime = a?.checkOut || a?.checkIn || '00:00';
                const bTime = b?.checkOut || b?.checkIn || '00:00';
                const aDate = new Date(`${a?.date || ''}T${aTime}`);
                const bDate = new Date(`${b?.date || ''}T${bTime}`);
                return bDate - aDate;
            });
    }, [myClinicLogs]);

    const completedClinicsToShow = useMemo(
        () => completedClinics.slice(0, clinicPageSize),
        [completedClinics, clinicPageSize],
    );
    const visibleCompletedClinics = useMemo(
        () => completedClinicsToShow,
        [completedClinicsToShow],
    );

    const totalClinicMinutes = useMemo(() => completedClinics.reduce((acc, log) => {
        if (getClinicDisplayStatus(log) === '미참석') return acc;
        const duration = Number(log?.durationMinutes);
        if (Number.isFinite(duration) && duration > 0) return acc + duration;
        if (log?.checkIn && log?.checkOut) return acc + Math.max(0, calculateDurationMinutes(log.checkIn, log.checkOut));
        return acc;
    }, 0), [completedClinics]);

    const reservedClinics = useMemo(() => myClinicLogs
        .filter((log) => ['예약됨', '입실 예정'].includes(getClinicDisplayStatus(log)))
        .sort((a, b) => new Date(`${a?.date || ''}T00:00:00`) - new Date(`${b?.date || ''}T00:00:00`)), [myClinicLogs]);

    const parentAuthUid = isMasterPreview ? (masterViewStudentAuthUid || activeChild?.authUid || userId || '') : (auth.currentUser?.uid || currentParent?.authUid || currentParent?.uid || userId || '');

    const visibleNotices = useMemo(() => {
        const normalizeTargetValue = (value) => String(value || '').trim();
        const normalizeTargetSet = (values = []) => new Set(
            (Array.isArray(values) ? values : [])
                .map(normalizeTargetValue)
                .filter(Boolean),
        );
        const viewerAudienceKeys = new Set([
            parentAuthUid,
            userId,
            ...(isMasterPreview ? [] : [auth.currentUser?.uid]),
            activeChild?.authUid,
            activeChildId,
        ].map(normalizeTargetValue).filter(Boolean));
        const visibleClassIdSetForNotice = new Set((visibleClassIds || []).map(String));
        const childId = String(activeChildId || '');
        const myClassIds = new Set(
            (Array.isArray(myClasses) ? myClasses : []).flatMap((cls) => ([
                cls?.id,
                cls?.classId,
                cls?.code,
                cls?.classCode,
                cls?.docId,
            ].map((v) => String(v || '').trim()).filter(Boolean))),
        );

        return (Array.isArray(notices) ? [...notices] : []).filter((notice) => {
            if (notice?.isPublic === true) return true;

            const audienceAuthUids = normalizeTargetSet(notice?.audienceAuthUids);
            if ([...viewerAudienceKeys].some((uid) => audienceAuthUids.has(uid))) return true;

            const targetClasses = normalizeTargetSet(notice?.targetClasses);
            const targetStudents = normalizeTargetSet(notice?.targetStudents);
            const targetAuthUids = normalizeTargetSet([
                ...(Array.isArray(notice?.audienceAuthUids) ? notice.audienceAuthUids : []),
                ...(Array.isArray(notice?.targetAuthUids) ? notice.targetAuthUids : []),
                ...(Array.isArray(notice?.visibleToAuthUids) ? notice.visibleToAuthUids : []),
            ]);
            const viewerNoticeKeys = new Set([
                parentAuthUid,
                activeChildId,
                activeChild?.id,
                activeChild?.uid,
                activeChild?.authUid,
            ].map(normalizeTargetValue).filter(Boolean));
            const matchesAuth = [...viewerNoticeKeys].some((key) => targetAuthUids.has(key));

            const matchesClass = [...targetClasses].some((classId) =>
                visibleClassIdSetForNotice.has(classId) || myClassIds.has(classId),
            );

            return matchesClass
                || (childId && targetStudents.has(childId))
                || matchesAuth;
        });
    }, [notices, visibleClassIds, activeChildId, parentAuthUid, myClasses, userId, activeChild]);

    const openBoardTab = useCallback(() => {
        setBoardBackTab(activeTab === 'more' ? 'more' : 'home');
        setActiveTab('board');
    }, [activeTab, setActiveTab]);
    const handleMoreViewChange = useCallback((nextView) => {
        if (nextView === 'board') {
            setBoardBackTab('more');
            setActiveTab('board');
            return;
        }
        setMoreView(nextView);
    }, []);

    const accountInfo = useMemo(() => ({
        parentName:
            currentParent?.name
            || currentParent?.parentName
            || currentParent?.displayName
            || currentParent?.guardianName
            || '',
        parentEmail:
            auth.currentUser?.email
            || currentParent?.email
            || currentParent?.googleEmail
            || currentParent?.loginEmail
            || '',
        parentPhone:
            currentParent?.phone
            || currentParent?.parentPhone
            || currentParent?.mobile
            || currentParent?.contact
            || '',
    }), [currentParent]);

    const sortedVisibleNotices = useMemo(() => sortNoticesForDisplay(visibleNotices), [visibleNotices]);
    const noticePreview = useMemo(() => sortedVisibleNotices.slice(0, 3), [sortedVisibleNotices]);

    useEffect(() => {
        const activeStudentClassIds = Array.from(new Set((visibleClassIds || []).map((id) => String(id)).filter(Boolean)));
        const activeStudentId = String(activeChildId || '');
        console.log('[parent board] viewer keys', {
            activeViewerAuthUid: parentAuthUid,
            activeStudentId,
            activeStudentClassIds,
        });
        console.log('[parent board] loaded announcements', {
            total: visibleNotices.length,
            sample: sortedVisibleNotices.slice(0, 3).map((n) => ({
                id: n.id,
                title: n.title,
                isPublic: n.isPublic,
                audienceAuthUidsCount: Array.isArray(n.audienceAuthUids) ? n.audienceAuthUids.length : 0,
                viewerAudienceKeys: [
                    parentAuthUid,
                    userId,
                    ...(isMasterPreview ? [] : [auth.currentUser?.uid]),
                    activeChild?.authUid,
                    activeChildId,
                ].map((v) => String(v || '').trim()).filter(Boolean),
                targetClasses: n.targetClasses,
                targetStudents: n.targetStudents,
                targetAuthUids: n.targetAuthUids,
            })),
        });
    }, [visibleClassIds, activeChildId, parentAuthUid, visibleNotices, sortedVisibleNotices, userId, activeChild]);

    const handleNotificationClick = async (notification) => {
        const refCollectionForLog = notification?.refCollection || (typeof notification?.ref === 'string' ? notification.ref.split('/').filter(Boolean)[0] : '');
        const refIdForLog = notification?.refId || (typeof notification?.ref === 'string' ? notification.ref.split('/').filter(Boolean)[1] : '');
        const roomIdForLog = notification?.roomId || notification?.chatRoomId || notification?.payload?.roomId || (['chatRooms', 'chats'].includes(refCollectionForLog) ? refIdForLog : '');
        console.log('[notification click]', { notificationId: notification?.id, refCollection: refCollectionForLog, refId: refIdForLog, roomId: roomIdForLog });
        if (isMasterPreview || readOnly) {
            showMasterViewUnavailable('알림');
            return;
        }
        const targetStudentId = notification?.studentId;
        const canSwitchStudent = targetStudentId
            && targetStudentId !== activeStudentId
            && Array.isArray(studentIds)
            && studentIds.includes(targetStudentId);

        if (canSwitchStudent) {
            await setActiveStudentId(targetStudentId);
            await waitForActiveStudentSwitch(targetStudentId);
        }

        if (!isMasterPreview && !readOnly) {
            try {
                await markNotificationRead({ viewerUid: parentNotificationUid, notificationId: notification.id, setNotifications });
            } catch (error) {
                console.error('[parent][notifications] mark single read failed', error);
            }
        }

        await openNotification({
            notification,
            onNavigate: ({ refCollection, refId }) => {
                if (refCollection === 'lessonLogs' || refCollection === 'lessonReports') {
                    setSelectedReportId(refId);
                    setActiveTab('report');
                    return;
                }

                if (refCollection === 'attendanceLogs') {
                    setActiveTab('report');
                    return;
                }

                if (refCollection === 'homeworkResults') {
                    setActiveTab('report');
                    return;
                }

                if (refCollection === 'grades') {
                    setActiveTab('report');
                    return;
                }

                if (refCollection === 'announcements' || refCollection === 'posts') {
                    setBoardBackTab('home');
                    setActiveTab('board');
                    return;
                }

                if (refCollection === 'chats' || refCollection === 'chatRooms') {
                    if (isMasterPreview || readOnly) return;
                    const roomId = notification?.roomId || notification?.chatRoomId || notification?.payload?.roomId || refId;
                    setInitialMessengerRoomId(roomId ? String(roomId) : '');
                    setIsMessengerPage(true);
                    return;
                }
            },
        });
        setIsNotificationOpen(false);
    };

    const handleMarkAllRead = async () => {
        console.log('[notifications] markAllRead clicked');
        if (isMasterPreview || readOnly) {
            showMasterViewUnavailable('알림 읽음 처리');
            return;
        }
        if (!parentNotificationUid) {
            console.warn('[notifications] no parentNotificationUid');
            return;
        }
        try {
            await markAllNotificationsRead({ viewerUid: parentNotificationUid, setNotifications });
            console.log('[notifications] markAllRead completed by callable');
        } catch (e) {
            console.error('[notifications] FAIL: markAllRead', e);
        }
    };

    const childAttendanceLogs = useMemo(() => {
        const targetStudentId = String(activeChildId || '');
        const targetStudentUid = String(activeChild?.studentUid || activeChild?.uid || '');
        const targetAuthUid = String(activeChild?.authUid || '');

        return filteredAttendanceLogs
            .filter((log) => {
                if (targetStudentId && String(log?.studentId || '') === targetStudentId) return true;
                if (targetStudentUid && String(log?.studentUid || '') === targetStudentUid) return true;
                if (targetAuthUid && String(log?.authUid || '') === targetAuthUid) return true;
                return false;
            })
            .sort((a, b) => new Date(b.date || b.createdAt || b.updatedAt || 0) - new Date(a.date || a.createdAt || a.updatedAt || 0));
    }, [filteredAttendanceLogs, activeChildId, activeChild?.studentUid, activeChild?.uid, activeChild?.authUid]);

    const formatScoreDisplay = useCallback((value) => formatStudentScore(value, { includeUnit: true }), []);

    const attendanceHistory = useMemo(() => {
        const list = Array.isArray(childAttendanceLogs) ? childAttendanceLogs : [];

        const getClassId = (log) =>
            String(
                log?.classId
                || log?.classID
                || log?.classDocId
                || log?.class
                || log?.class?.id
                || ''
            );

        const getAttendance = (log) =>
            log?.status
            || log?.attendance
            || log?.attendanceStatus
            || log?.attendanceType
            || null;

        const getDate = (log) =>
            log?.date
            || log?.lessonDate
            || log?.recordedAt
            || log?.createdAt
            || null;

        const getMemo = (log) =>
            log?.reason
            || log?.memo
            || log?.note
            || log?.comment
            || '';

        const items = list
            .map((log) => ({
                id: log?.id || `${getDate(log)}-${getAttendance(log)}-${getClassId(log)}`,
                classId: getClassId(log),
                date: getDate(log),
                attendance: getAttendance(log),
                memo: getMemo(log),
            }))
            .filter((item) => item.attendance);

        items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        return items;
    }, [childAttendanceLogs]);

    // ✅ 리포트 데이터 생성 (현재 선택된 리포트 ID가 있을 때만)
    const activeReport = useMemo(() => {
        if (!selectedReportId) return null;
        const contextData = { lessonLogs: filteredLessonLogs, attendanceLogs: filteredAttendanceLogs, homeworkAssignments: filteredHomeworkAssignments, homeworkResults, tests: filteredTests, grades, classes, classTestStats };
        return generateSessionReport(selectedReportId, activeChildId, contextData);
    }, [selectedReportId, activeChildId, filteredLessonLogs, filteredAttendanceLogs, filteredHomeworkAssignments, homeworkResults, filteredTests, grades, classes, classTestStats]);

    const sentLessonReports = useMemo(() => (Array.isArray(lessonReports) ? lessonReports : [])
        .filter((report) => report?.status === 'sent' && String(report?.studentId || '') === String(activeChildId || '') && isVisibleClassItem(report))
        .map((report) => ({ ...report, className: classes.find((c) => String(c.id) === String(report.classId))?.name || report.classId }))
        .sort((a, b) => String(b.lessonDate || '').localeCompare(String(a.lessonDate || ''))), [lessonReports, activeChildId, isVisibleClassItem, classes]);
    const lessonReportClassOptions = useMemo(() => {
        const map = new Map();
        sentLessonReports.forEach((report) => {
            const classId = String(report.classId || '');
            if (!classId) return;
            map.set(classId, report.className || classId);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [sentLessonReports]);
    const filteredLessonReports = useMemo(() => {
        if (lessonReportClassFilter === 'all') return sentLessonReports;
        return sentLessonReports.filter((report) => String(report.classId || '') === String(lessonReportClassFilter));
    }, [lessonReportClassFilter, sentLessonReports]);
    const visibleLessonReports = useMemo(
        () => (showAllLessonReports ? filteredLessonReports : filteredLessonReports.slice(0, 3)),
        [filteredLessonReports, showAllLessonReports],
    );


    const learningDataByClass = useMemo(() => {
        const classMap = new Map(myClasses.map((cls) => [String(cls.id), cls]));
        const homeworkMap = new Map();
        myHomeworkStats.forEach((hw) => {
            const classId = String(hw.classId || '');
            if (!classId) return;
            if (!homeworkMap.has(classId)) homeworkMap.set(classId, []);
            homeworkMap.get(classId).push(hw);
        });

        const gradesMap = new Map();
        (filteredTests || []).forEach((test) => {
            const classId = String(test.classId || '');
            if (!classId) return;
            if (!gradesMap.has(classId)) gradesMap.set(classId, []);
            gradesMap.get(classId).push(test);
        });

        const attendanceMap = new Map();
        attendanceHistory.forEach((item) => {
            const classId = String(item.classId || '');
            if (!classId) return;
            if (!attendanceMap.has(classId)) attendanceMap.set(classId, []);
            attendanceMap.get(classId).push(item);
        });

        return orderedClasses.map((cls) => ({
            classId: String(cls.id),
            classInfo: classMap.get(String(cls.id)) || cls,
            homework: homeworkMap.get(String(cls.id)) || [],
            grades: (gradesMap.get(String(cls.id)) || []).map((test) => {
                const studentRecord = grades?.[activeChildId]?.[test.id] || {};
                return {
                    ...test,
                    studentScore: studentRecord,
                };
            }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))),
            attendance: (attendanceMap.get(String(cls.id)) || []).slice(0, 10),
        }));
    }, [myClasses, myHomeworkStats, filteredTests, attendanceHistory, orderedClasses, grades, activeChildId]);

    const toggleHomeworkDetail = useCallback((homeworkId) => {
        setExpandedHomeworkDetails((prev) => ({ ...prev, [homeworkId]: !prev[homeworkId] }));
    }, []);

    const learningClassOptions = useMemo(() => {
        const ongoing = ongoingClasses.map((cls) => ({ id: String(cls.id), name: cls.name || String(cls.id), isClosed: false }));
        const closed = [...finishedClasses, ...withdrawnClasses]
            .map((cls) => ({ id: String(cls.id), name: cls.name || String(cls.id), isClosed: true }));
        return [{ id: 'all', name: '전체', isClosed: false }, ...ongoing, ...closed];
    }, [ongoingClasses, finishedClasses, withdrawnClasses]);

    useEffect(() => {
        const firstOngoing = ongoingClasses[0] ? String(ongoingClasses[0].id) : 'all';
        if (!classFilter || classFilter === 'ongoing') {
            setClassFilter(firstOngoing);
            return;
        }
        if (classFilter !== 'all' && !learningClassOptions.some((item) => item.id === classFilter)) {
            setClassFilter(firstOngoing);
        }
    }, [ongoingClasses, classFilter, learningClassOptions]);

    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'report', icon: 'clipboardCheck', label: '수업리포트' },
        { id: 'learning', icon: 'clipboardCheck', label: '학습관리' },
        { id: 'schedule', icon: 'calendar', label: '일정' },
        { id: 'more', icon: 'menu', label: '전체' },
    ];

    if (!activeChild) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
                학생 정보를 불러오는 중...
            </div>
        );
    }

    if (isMessengerPage) {
        return (
            <ParentMessengerPage
                studentId={activeChildId}
                student={activeChild}
                ongoingClasses={ongoingClasses}
                notificationViewerUid={parentNotificationUid}
                initialRoomId={initialMessengerRoomId}
                notifications={notifications}
                setNotifications={setNotifications}
                onBack={() => setIsMessengerPage(false)}
            />
        );
    }

    return (
        <div className={`mobile-screen bg-gray-50 flex flex-col relative font-sans ${embedded ? 'h-full min-h-0' : 'min-h-screen'}`}>
            {/* 헤더 & 자녀 선택 */}
            <div className="parent-mobile-header mobile-header bg-white sticky top-0 z-30 shadow-sm">
                <div className="mobile-header-content flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-2 min-w-0">
                        <img
                            src={logoHorizontal}
                            alt="채수용 수학"
                            className="h-8 w-auto max-w-[132px] object-contain shrink-0"
                        />
                        <div className="min-w-0">
                            <p className="sr-only">채수용 수학</p>
                            <p className="text-xs text-gray-500 truncate">{activeChildName} · {activeChildSchool} {activeChildGrade}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => (isMasterPreview || readOnly ? showMasterViewUnavailable('알림') : setIsNotificationOpen(true))} className="relative min-w-11 min-h-11 p-2 rounded-lg border border-gray-200 text-gray-600">
                            <NotificationsIcon style={{ fontSize: 20 }} />
                            {hasUnread && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
                        </button>
                        <button type="button" onClick={() => (isMasterPreview || readOnly ? showMasterViewUnavailable('메신저') : setIsMessengerPage(true))} className="relative min-w-11 min-h-11 p-2 rounded-lg border border-gray-200 text-gray-600">
                            <ChatBubbleOutlineIcon style={{ fontSize: 20 }} />
                        </button>
                    </div>
                </div>
            </div>

            <main ref={mainScrollRef} className={`flex-1 w-full max-w-md mx-auto p-4 overflow-y-auto custom-scrollbar md:max-w-7xl ${embedded ? 'min-h-0 pb-4' : 'pb-24'}`}>
                {/* [라우팅 분기 1] 리포트 상세 화면 */}
                {selectedReportId ? (
                    <ParentSessionReport
                        report={activeReport}
                        onBack={() => setSelectedReportId(null)}
                    />
                ) : selectedClassroomId ? (
                    /* [라우팅 분기 2] 강의실 화면 */
                    <ParentClassroomView
                        cclasses={classes} lessonLogs={filteredLessonLogs} attendanceLogs={filteredAttendanceLogs}
                        selectedClassId={selectedClassroomId} setSelectedClassId={setSelectedClassroomId}
                        videoProgress={filteredVideoProgress} homeworkAssignments={filteredHomeworkAssignments} homeworkResults={homeworkResults}
                        tests={filteredTests} grades={grades}
                        onNavigateToTab={() => { setSelectedClassroomId(null); setActiveTab('report'); }}
                        onOpenReport={(sessionId) => setSelectedReportId(sessionId)}
                        activeStudentName={activeChildName}
                    />
                ) : (
                    /* [라우팅 분기 3] 메인 */
                    <div className="animate-fade-in space-y-4">
                        {activeTab === 'home' && (
                            <div className="space-y-3">
                                <section className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: '출결 상세보기', subTab: 'attendance' },
                                        { label: '과제 상세보기', subTab: 'homework' },
                                        { label: '성적 상세보기', subTab: 'grades' },
                                        ].map((item) => (
                                        <button key={item.label} onClick={() => { setLearningMode('regular'); setLearningSubTab(item.subTab); setActiveTab('learning'); }} className="bg-white border border-gray-200 rounded-2xl p-4 text-sm font-bold text-gray-800 text-left">
                                            {item.label}
                                        </button>
                                    ))}
                                    <button onClick={() => { setLearningMode('clinic'); setActiveTab('learning'); }} className="bg-white border border-gray-200 rounded-2xl p-4 text-sm font-bold text-gray-800 text-left">
                                        클리닉 상세보기
                                    </button>
                                </section>

                                <div className="grid gap-3 lg:grid-cols-3">
                                    <div className="lg:col-span-2">
                                        <ParentDashboard
                                            child={activeChild} myClasses={myClasses} attendanceLogs={filteredAttendanceLogs}
                                            homeworkStats={myHomeworkStats} gradeComparison={myGradeComparison}
                                            clinicLogs={clinicLogs} unpaidPayments={unpaidPayments}
                                            setActiveTab={setActiveTab}
                                            childClassExitMap={childClassExitMap}
                                            activeChildId={activeChildId}
                                            closures={closures}
                                        />
                                    </div>
                                    <aside className="space-y-3">
                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                    <Icon name="megaphone" className="w-4 h-4 text-[#455fab]" />
                                                    게시판
                                                </h3>
                                                <button onClick={openBoardTab} className="text-xs text-[#455fab] font-semibold hover:underline">전체 보기</button>
                                            </div>
                                            <div className="space-y-2">
                                                {noticePreview.length > 0 ? noticePreview.map(notice => (
                                                    <button 
                                                        key={notice.id} 
                                                        onClick={openBoardTab}
                                                        className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-[#cfd8ff] hover:bg-[#f1f4ff] transition-colors"
                                                    >
                                                        <p className="text-sm font-bold text-gray-900">{notice.title}</p>
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{getNoticePreviewText(notice.content, 80)}</p>
                                                        <p className="text-[11px] text-gray-400 mt-1">{notice.author || '채수용 수학'} • {formatNoticeDate(getNoticeDateValue(notice))}</p>
                                                    </button>
                                                )) : (
                                                    <p className="text-xs text-gray-500 py-2 text-center">등록된 게시글이 없습니다.</p>
                                                )}
                                            </div>
                                        </div>

                                    </aside>
                                </div>
                            </div>
                        )}

                        {activeTab === 'report' && (
                            <div className="space-y-6">
                                    <section className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            <Icon name="clipboardCheck" className="w-5 h-5 text-[#455fab]" />
                                            발송된 수업 리포트
                                        </h3>
                                        <span className="text-xs text-gray-400 font-semibold">총 {filteredLessonReports.length}건</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLessonReportClassFilter('all');
                                                setShowAllLessonReports(false);
                                            }}
                                            className={lessonReportClassFilter === 'all'
                                                ? 'text-xs font-semibold text-[#334a91] bg-[#f1f4ff] px-3 py-1.5 rounded-full border border-[#eef2ff]'
                                                : 'text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200'}
                                        >
                                            전체 클래스
                                        </button>
                                        {lessonReportClassOptions.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => {
                                                    setLessonReportClassFilter(option.id);
                                                    setShowAllLessonReports(false);
                                                }}
                                                className={lessonReportClassFilter === option.id
                                                    ? 'text-xs font-semibold text-[#334a91] bg-[#f1f4ff] px-3 py-1.5 rounded-full border border-[#eef2ff]'
                                                    : 'text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200'}
                                            >
                                                {option.name}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="space-y-3">
                                        {visibleLessonReports.map((report) => (
                                            <div key={report.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
                                                <p className="text-[11px] text-gray-400 font-semibold">{report.lessonDate} • {report.className}</p>
                                                {report.learnedTopics && <p className="text-sm text-gray-700">진도: {report.learnedTopics}</p>}
                                                {report.attendanceStatus && <p className="text-sm text-gray-700">출결: {report.attendanceStatus}</p>}
                                                {Array.isArray(report?.homeworkSummary?.text) && report.homeworkSummary.text.length > 0 && <p className="text-sm text-gray-700">과제 수행: {report.homeworkSummary.text.join(' · ')}</p>}
                                                {Array.isArray(report?.assignedHomeworkSummary?.items) && report.assignedHomeworkSummary.items.length > 0 && (
                                                    <p className="text-sm text-gray-700">이번 수업 숙제: {report.assignedHomeworkSummary.items.map((item) => item.title).filter(Boolean).join(', ')}</p>
                                                )}
                                                {Array.isArray(report?.testSummary?.text) && report.testSummary.text.length > 0 && (
                                                    <div className="text-sm text-gray-700">
                                                        <p className="font-semibold">시험</p>
                                                        <ul className="list-disc pl-5">
                                                            {report.testSummary.text.map((line, index) => (
                                                                <li key={`report-test-${report.id}-${index}`} className="whitespace-pre-line">{line}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {report.comment && <p className="text-sm text-[#334a91]">코멘트: {report.comment}</p>}
                                            </div>
                                        ))}
                                        {filteredLessonReports.length === 0 && (
                                            <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                발송된 수업 리포트가 아직 없습니다.
                                            </div>
                                        )}
                                        {filteredLessonReports.length > 3 && (
                                            <div className="px-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllLessonReports((prev) => !prev)}
                                                    className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-200 active:scale-95 transition"
                                                >
                                                    {showAllLessonReports ? '접기' : '이전 리포트 더보기'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'schedule' && (
                            <div className="space-y-3"><div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"><h3 className="mb-1 text-sm font-semibold text-gray-900">오늘/이번 주 일정</h3><p className="text-xs text-gray-500">일정을 간결한 리스트로 확인하세요.</p></div><div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"><ScheduleTab 
                                myClasses={myClasses} attendanceLogs={filteredAttendanceLogs} clinicLogs={clinicLogs}
                                externalSchedules={externalSchedules} onSaveExternalSchedule={onSaveExternalSchedule} onDeleteExternalSchedule={onDeleteExternalSchedule}
                                student={activeChild}
                                childClassExitMap={childClassExitMap}
                                closures={closures}
                            /></div></div>
                        )}

                        {activeTab === 'learning' && (
                            <div className="space-y-3">
                                <section className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'regular', label: '정규 수업' },
                                            { id: 'clinic', label: '클리닉' },
                                        ].map((mode) => (
                                            <button
                                                key={mode.id}
                                                type="button"
                                                onClick={() => setLearningMode(mode.id)}
                                                className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                                                    learningMode === mode.id
                                                        ? 'bg-[#455fab] text-white'
                                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {learningMode === 'regular' && (
                                    <>
                                        <section className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
                                            <label className="block text-xs font-semibold text-gray-500 mb-2">클래스 필터</label>
                                            <select
                                                value={classFilter}
                                                onChange={(e) => setClassFilter(e.target.value)}
                                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#cfd8ff]"
                                            >
                                                {learningClassOptions.map((option) => (
                                                    <option key={option.id} value={option.id}>
                                                        {option.name}{option.isClosed ? ' (종강/퇴원)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </section>
                                        <section className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: 'homework', label: '과제' },
                                                    { id: 'grades', label: '성적' },
                                                    { id: 'attendance', label: '출결' },
                                                ].map((tab) => (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        onClick={() => setLearningSubTab(tab.id)}
                                                        className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors ${
                                                            learningSubTab === tab.id
                                                                ? 'bg-[#455fab] text-white'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                    >
                                                        {tab.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </section>
                                    

                                {learningMode === 'regular' && learningSubTab === 'homework' && (
                                    <div ref={(el) => { learningSectionRefs.current.homework = el; }} className="space-y-3">
                                        {(classFilter === 'all' ? learningDataByClass : learningDataByClass.filter((section) => section.classId === classFilter)).map((section) => (
                                            <section key={section.classId} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm space-y-2">
                                                <h3 className="text-sm font-semibold text-gray-900">{section.classInfo?.name || section.classId}</h3>
                                                {section.homework.length === 0 ? (
                                                    <p className="text-sm text-gray-500">과제 기록이 없습니다.</p>
                                                ) : section.homework.map((hw) => {
                                                    const counts = {
                                                        correct: Number(hw.correctCount ?? hw.correct ?? 0),
                                                        wrong: Number(hw.wrongCount ?? hw.incorrectCount ?? hw.wrong ?? 0),
                                                        fixed: Number(hw.fixedCount ?? hw.revisedCount ?? hw.fixed ?? 0),
                                                        };
                                                    const completedCount = counts.correct + counts.wrong + counts.fixed;
                                                    const totalCount = Number(hw.totalCount ?? hw.totalQuestions ?? hw.questionNumbers?.length ?? 0);
                                                    counts.remaining = Math.max(totalCount - completedCount, 0);
                                                    const total = Number.isFinite(totalCount) && totalCount > 0
                                                        ? totalCount
                                                        : Object.values(counts).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
                                                    const width = (value) => (total > 0 ? `${(value / total) * 100}%` : '0%');
                                                    return (
                                                        <article key={hw.id} className="rounded-xl border border-gray-200 p-2.5 space-y-2">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="text-sm font-semibold text-gray-900">{resolveHomeworkAssignmentTitle(hw)}</p>
                                                                <span className="text-[11px] font-semibold text-[#334a91] bg-[#f1f4ff] border border-[#eef2ff] rounded-full px-2 py-0.5">
                                                                    완성률 {hw.completionRate ?? 0}%
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500">출제일 {hw.date || hw.assignedDate || "-"}</p>
                                                            <div className="w-full h-2 rounded-full overflow-hidden bg-gray-100 flex">
                                                                <div className="bg-emerald-400" style={{ width: width(counts.correct) }} />
                                                                <div className="bg-rose-400" style={{ width: width(counts.wrong) }} />
                                                                <div className="bg-sky-400" style={{ width: width(counts.fixed) }} />
                                                                <div className="bg-slate-300" style={{ width: width(counts.remaining) }} />
                                                            </div>
                                                           <p className="text-xs font-semibold">
                                                                <span className="text-emerald-600">맞음 {counts.correct}</span> / <span className="text-red-500">틀림 {counts.wrong}</span> / <span className="text-sky-500">고침 {counts.fixed}</span> / <span className="text-gray-400">남음 {counts.remaining}</span>
                                                            </p>
                                                        </article>
                                                    );
                                                })}
                                            </section>
                                        ))}
                                    </div>
                                )}

                                {learningMode === 'regular' && learningSubTab === 'grades' && (
                                    <div ref={(el) => { learningSectionRefs.current.grades = el; }} className="space-y-3">
                                        {(classFilter === 'all' ? learningDataByClass : learningDataByClass.filter((section) => section.classId === classFilter)).map((section) => (
                                            <section key={section.classId} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm space-y-2">
                                                <h3 className="text-sm font-semibold text-gray-900">{section.classInfo?.name || section.classId}</h3>
                                                {section.grades.length === 0 ? (
                                                    <p className="text-sm text-gray-500">시험 기록이 없습니다.</p>
                                                ) : section.grades.map((test) => {
                                                    const statsForDisplay = getTestStatsForDisplay(test, classTestStats);
                                                    const studentScoreLabel = formatScoreDisplay(test.studentScore);
                                                    const statsInline = formatTestStatsInline(statsForDisplay, { includeUnit: true });
                                                    return (
                                                        <article key={test.id} className="rounded-xl border border-gray-200 p-3 space-y-1 text-sm text-gray-700">
                                                            <div className="flex items-start justify-between gap-2">
                                                            <p className="font-bold text-gray-900">{test.name || '시험'}</p>
                                                            <span className="text-[11px] font-semibold text-[#334a91] bg-[#f1f4ff] border border-[#eef2ff] rounded-full px-2 py-0.5">{studentScoreLabel}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-500">{test.date || '-'}</p>
                                                            {statsInline && (
                                                                <p className="text-xs text-gray-500 mt-2">{statsInline}</p>
                                                            )}
                                                        </article>
                                                    );
                                                })}
                                            </section>
                                        ))}
                                    </div>
                                )}

                                {learningMode === 'regular' && learningSubTab === 'attendance' && (
                                    <div ref={(el) => { learningSectionRefs.current.attendance = el; }} className="space-y-3">
                                        {(classFilter === 'all' ? learningDataByClass : learningDataByClass.filter((section) => section.classId === classFilter)).map((section) => (
                                            <section key={section.classId} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm space-y-2">
                                                <h3 className="text-sm font-semibold text-gray-900">{section.classInfo?.name || section.classId}</h3>
                                                {section.attendance.length === 0 ? (
                                                    <p className="text-sm text-gray-500">출결 기록이 없습니다.</p>
                                                ) : (
                                                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                                                        {section.attendance
                                                            .slice()
                                                            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
                                                            .map((att) => {
                                                                const status = String(att.attendance || '미기록').trim() || '미기록';
                                                                const badgeClass =
                                                                    status === '출석'
                                                                        ? 'bg-[#eef2ff] text-[#334a91]'
                                                                        : status === '지각'
                                                                            ? 'bg-amber-100 text-amber-700'
                                                                            : status === '결석'
                                                                                ? 'bg-rose-100 text-rose-700'
                                                                                : status === '동영상보강'
                                                                                    ? 'bg-blue-100 text-[#334a91]'
                                                                                    : 'bg-gray-100 text-gray-600';

                                                                return (
                                                                    <div key={att.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0 bg-white">
                                                                        <span className="text-sm font-medium text-gray-700">{att.date || '-'}</span>
                                                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${badgeClass}`}>{status}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                )}
                                            </section>
                                        ))}
                                    </div>
                                )}

                                </>
                            )}
                                {learningMode === 'clinic' && (
                                    <section ref={(el) => { learningSectionRefs.current.clinic = el; }} className="space-y-3"> 
                                        <article className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-gray-900">누적 클리닉 시간</h3>
                                                <span className="text-sm font-semibold text-teal-700">{formatDuration(totalClinicMinutes)}</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min(100, (totalClinicMinutes / 600) * 100)}%` }} />
                                                </div>
                                            </article>

                                            <article className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm space-y-2">
                                                <h3 className="text-sm font-semibold text-gray-900">예약된 일정</h3>
                                                {reservedClinics.length === 0 ? (
                                                    <p className="text-sm text-gray-500">예약된 클리닉이 없습니다.</p>
                                                ) : reservedClinics.slice(0, 20).map((log, idx) => (
                                                    <div key={log.id || `${log.date}-${idx}`} className="rounded-2xl border border-sky-100 bg-sky-50/30 p-3 space-y-1">
                                                        <p className="text-xs text-gray-500">{log.date || '-'} · {formatClinicTimeLabel(log)}</p>
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-sm font-bold text-gray-900">입실 예정</p>
                                                            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${getParentClinicStatusStyle(log.displayStatus)}`}>{log.displayStatus}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-600">담당 조교: {log.teacherResolved}</p>
                                                    </div>
                                                ))}
                                            </article>

                                            <article className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm space-y-2">
                                                <h3 className="text-sm font-semibold text-gray-900">클리닉 코멘트</h3>
                                                {visibleCompletedClinics.length === 0 ? (
                                                    <p className="text-sm text-gray-500">클리닉 기록이 없습니다.</p>
                                                ) : visibleCompletedClinics.slice(0, 20).map((log) => {
                                                    const commentKey = log.id ?? `${log.date}-${log.checkIn || log.checkOut || 'clinic'}`;
                                                    const isExpanded = !!expandedHomeworkDetails[`clinic-comment-${commentKey}`];
                                                    const commentText = String(log.commentResolved || '-');
                                                    const isLongComment = commentText.length > 90;
                                                    const displayedComment = isExpanded || !isLongComment ? commentText : `${commentText.slice(0, 90)}...`;
                                                    return (
                                                        <article key={commentKey} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="text-xs text-gray-500">{log.date || '-'} · {formatClinicTimeLabel(log)}</p>
                                                                    <p className="text-xs text-gray-600">담당 조교: {buildClinicTeacher(log)}</p>
                                                                </div>
                                                                <span className={`text-xs font-bold rounded-full px-2 py-1 border ${getParentClinicStatusStyle(getClinicDisplayStatus(log))}`}>
                                                                    {getClinicDisplayStatus(log)}
                                                                </span>
                                                            </div>
                                                            <MathText text={displayedComment} className="text-xs text-gray-700 leading-5" inlineTextClassName="text-xs text-gray-700 leading-5" />
                                                            {isLongComment && (
                                                                <button type="button" onClick={() => toggleHomeworkDetail(`clinic-comment-${commentKey}`)} className="text-xs font-semibold text-[#334a91]">{isExpanded ? '접기' : '더보기'}</button>
                                                            )}
                                                        </article>
                                                    );
                                                })}
                                                {visibleCompletedClinics.length < completedClinics.length && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setClinicPageSize((v) => v + 3)}
                                                        className="w-full text-xs font-semibold text-[#334a91] border border-[#eef2ff] bg-[#f1f4ff] rounded-xl py-2"
                                                    >
                                                        코멘트 3개 더보기
                                                    </button>
                                                )}
                                            </article>
                                        </section>
                                    )}
                            </div>
                        )}
                        {(activeTab === 'board' || activeTab === 'notices') && (
                            <ParentBoardPage notices={visibleNotices} onBack={() => setActiveTab(boardBackTab || 'home')} />
                        )}
                        {activeTab === 'more' && (
                            <ParentMorePage
                                moreView={moreView}
                                onChangeView={handleMoreViewChange}
                                notices={visibleNotices}
                                activeChild={activeChild}
                                currentParent={currentParent}
                                accountInfo={accountInfo}
                                myClasses={myClasses}
                                ongoingClasses={ongoingClasses}
                                onOpenNotifications={() => (isMasterPreview || readOnly ? showMasterViewUnavailable('알림') : setIsNotificationOpen(true))}
                                onOpenMessages={() => (isMasterPreview || readOnly ? showMasterViewUnavailable('메신저') : setIsMessengerPage(true))}
                                onLogout={onLogout}
                            />
                        )}
                    </div>
                )}
            </main>

            {!selectedReportId && (
                <div className={`${embedded ? 'sticky bottom-0' : 'fixed bottom-0 left-0 right-0'} bg-white border-t border-gray-200 z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.03)] h-[calc(60px+env(safe-area-inset-bottom))]`}>
                    <div className="max-w-md mx-auto flex justify-around items-center h-[60px] md:max-w-7xl">
                        {navItems.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => setActiveTab(item.id)} 
                                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 ${activeTab === item.id ? 'text-[#334a91]' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <div className={`mb-1 transition-transform duration-200 ${activeTab === item.id ? '-translate-y-0.5' : ''}`}>
                                    <Icon name={item.icon} className={`w-6 h-6 ${activeTab === item.id ? 'fill-current' : ''}`} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                                </div>
                                <span className={`text-[10px] ${activeTab === item.id ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {FEATURES.ENABLE_FLOATING_NOTIFICATIONS_FOR_VIEWERS && (
                <div className={`${embedded ? 'absolute bottom-24 right-5' : 'fixed bottom-24 right-5'} z-[60] flex flex-col gap-3 items-center`}>
                    <button
                        onClick={() => (isMasterPreview || readOnly ? showMasterViewUnavailable('알림') : setIsNotificationOpen(true))}
                        className="bg-white text-[#334a91] border border-[#cfd8ff] p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative w-12 h-12"
                    >
                        <NotificationsIcon style={{ fontSize: 24 }} />
                        {hasUnread && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}
                    </button>
                </div>
            )}

            <NotificationList
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllRead={handleMarkAllRead}
                unreadCount={unreadCount}
                lastReadAt={lastReadAt}
                isLoading={isLoading || isMetaLoading}
                unreadOnly
            />
        </div>
    );
}

// changed: hide ended classes in today’s lessons
