// src/pages/ParentHome.jsx
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    doc,
    serverTimestamp,
} from 'firebase/firestore';
import { ScheduleTab, MenuTab } from '../components/StudentTabs';
import ParentClassroomView from './parent/ParentClassroomView';
import StudentHeader from '../components/StudentHeader';
import {
    Icon,
    calculateHomeworkStats,
    calculateGradeComparison,
    getClinicComment,
    getClinicDisplayStatus,
    isClosedForClass,
    normalizeClassSchedule,
    isClassActiveForStudent,
    formatClassScheduleKo,
    hasClassOnDate,
    getClassTimeOnDate,
} from '../utils/helpers';
import { formatGradeScoreText } from '../domain/grade/grade.service';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ParentSessionReport from './parent/ParentSessionReport'; // ✅ 신규 리포트 컴포넌트
import { generateSessionReport } from '../utils/reportHelper'; // ✅ 리포트 데이터 생성 헬퍼
import useNotifications from '../notifications/useNotifications';
import NotificationList from '../notifications/NotificationList';
import openNotification from '../notifications/openNotification';
import { useParentContext } from '../parent';
import { sortClassesByStatus } from '../utils/classStatus';
import { db } from '../firebase/client';
import { FEATURES } from '../config/features';
import AttendanceDetailModal from './parent/AttendanceDetailModal';
import MathText from '../components/common/MathText';

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
    for (const item of list) {
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




const isClassActiveForToday = (cls, student) => {
    if (!cls) return false;

    const classStatus = String(cls.status || '').trim();
    if (['종강', '전반', '퇴원', '종료', 'ended', 'inactive'].includes(classStatus)) return false;

    const map = student?.classStatusMap || student?.classStatuses || {};
    const entry = map?.[String(cls.id)] || null;
    const entryStatus = String(entry?.status || '').trim();
    if (['종강', '전반', '퇴원'].includes(entryStatus)) return false;

    const toYmd = (v) => {
        if (!v) return null;
        if (typeof v === 'string') return v.slice(0, 10);
        if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
        try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
    };

    const today = new Date().toISOString().slice(0, 10);
    const endedYmd = toYmd(entry?.endedAt || entry?.endDate || cls.endedAt || cls.endDate);
    if (endedYmd && endedYmd <= today) return false;

    return true;
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
    const todayStr = today.toISOString().split('T')[0];
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
        
        let attendStatus = { color: 'bg-indigo-50 text-indigo-700 border-indigo-100', label: '정상', icon: 'check' };
        if (attendRate < 50) attendStatus = { color: 'bg-red-50 text-red-700 border-red-100', label: '주의 필요', icon: 'alertCircle' };
        else if (attendRate < 80) attendStatus = { color: 'bg-orange-50 text-orange-700 border-orange-100', label: '확인 요망', icon: 'alertCircle' };

        // [과제] 미제출 건수 기준
        const pendingCount = homeworkStats.filter(h => !h.isComplete).length;
        let hwStatus = { color: 'bg-indigo-50 text-indigo-700 border-indigo-100', label: '양호' };
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
                if (latestScore > prevScore) gradeStatus = { color: 'bg-blue-50 text-blue-700 border-blue-100', label: '상승세' };
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
    const isWithdrawn = (st) => {
        const value = String(st || '').trim();
        return ['퇴원', '중도퇴원', '전반', '전반퇴원'].includes(value);
    };

    const toMs = (value) => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    };

    const todayItems = useMemo(() => {
        const visibleTodayClasses = myClasses.filter((cls) => {
            if (!cls?.id) return false;
            if (!isClassActiveForStudent({ cls, student: child, todayYmd: todayStr })) return false;
            return true;
        });

        const todayClinicSchedules = clinicLogs
            .filter((l) => l.studentId === child.id && l.date === todayStr)
            .map((l) => ({
                type: 'clinic',
                time: l.checkIn || (typeof l?.plannedTime === 'string' ? l.plannedTime : l.plannedTime?.start) || '99:99',
                timeLabel: formatClinicTime(l),
                title: '클리닉',
                sub: `선생님: ${buildClinicTeacher(l)} • ${buildClinicStatus(l)}`,
                date: l.date,
            }));

        const todaysClasses = visibleTodayClasses
            .filter((c) => hasClassOnDate(c, todayStr))
            .map((c) => {
                const todayTime = getClassTimeOnDate(c, todayStr);
                const startTime = String(todayTime || '').split('~')[0] || '99:99';
                return {
                    type: 'class',
                    classId: c.id,
                    classCode: c.classId || c.code || c.classCode || c.key || null,
                    time: startTime,
                    title: c.name,
                    sub: `${c.teacher} 선생님`,
                    timeLabel: todayTime,
                    todayTime,
                    scheduleLabel: formatClassScheduleKo(c),
                    date: todayStr,
                };
            });
        return [
            ...todaysClasses,
            ...todayClinicSchedules,
        ].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    }, [child, clinicLogs, myClasses, todayDayName, todayStr]);

    const filteredTodayItems = useMemo(() => {
        const list = Array.isArray(todayItems) ? todayItems : [];

        const getClassId = (item) => String(item?.classId || item?.classDocId || item?.class?.id || '');
        const getClassCode = (item) => String(item?.classCode || item?.classKey || item?.code || '');
        const getAtMs = (item) => {
            const raw = item?.date || item?.lessonDate || item?.startAt || item?.scheduledAt || item?.createdAt || null;
            return toMs(raw) ?? toMs(new Date());
        };

        const shouldHideTodayItemByExit = (itemDayValue, exitDayValue) => itemDayValue >= exitDayValue;

        return list.filter((item) => {
            const classId = getClassId(item);
            const classCode = getClassCode(item);
            if (!classId) return true;

            if (isClosedForClass(todayStr, classId, closures)) return false;

            const exit = childClassExitMap?.[classId]
                || (classCode ? childClassExitMap?.[classCode] : null);
            if (!exit) return true;

            if (!isWithdrawn(exit.status)) return true;
            if (!exit.exitAtMs) return false;

            const itemDayMs = new Date(getAtMs(item)).setHours(0, 0, 0, 0);
            const exitDayMs = new Date(exit.exitAtMs).setHours(0, 0, 0, 0);
            return !shouldHideTodayItemByExit(itemDayMs, exitDayMs);
        });
    }, [todayItems, childClassExitMap, closures, todayStr]);

    useEffect(() => {
        console.log('[parent][today] activeChildId=', activeChildId);
        console.log('[parent][today] childClassExitMap=', childClassExitMap);
        console.log('[parent][today] childClassExitMap keys=', Object.keys(childClassExitMap || {}));
        console.log('[parent][today] todayItems=', todayItems);
        console.log('[parent][today] filteredTodayItems=', filteredTodayItems);
    }, [activeChildId, childClassExitMap, todayItems, filteredTodayItems]);

    // 3. 확인 필요 항목 (Action Items)
    const actionItems = [];
    if (statusData.attend.label !== '정상') {
        actionItems.push({ id: 'att', type: 'warning', text: '최근 출결 상태 확인이 필요합니다.', link: 'report' });
    }
    if (statusData.hw.label === '제출 지연') {
        actionItems.push({ id: 'hw', type: 'warning', text: '장기 미제출 과제가 확인되었습니다.', link: 'report' });
    }

    return (
        <div className="space-y-6 pb-6 animate-fade-in-up">
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
                        <Icon name="calendar" className="w-4 h-4 text-indigo-600" />
                        오늘의 수업 ({filteredTodayItems.length})
                    </h3>
                    <span className="text-xs text-gray-500">{today.getMonth() + 1}월 {today.getDate()}일 ({todayDayName})</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredTodayItems.length > 0 ? (
                        filteredTodayItems.map((item, idx) => (
                             <div key={idx} className="flex items-center gap-3 p-3 hover:bg-indigo-50 rounded-xl transition-colors border border-gray-100">
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
    userId, students, classes, homeworkAssignments, homeworkResults,
    attendanceLogs, lessonLogs, notices, tests, grades, classTestStats,
    videoProgress, clinicLogs, lessonReports = [], onLogout,
    externalSchedules, onSaveExternalSchedule, onDeleteExternalSchedule,
    closures,
}) {
    const todayStr = useMemo(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }, []);
    const { activeStudentId, studentIds, setActiveStudentId } = useParentContext();
    // 1. 자녀 데이터 및 선택 로직
    const initialStudent = students.find(s => s.id === activeStudentId);
    const [activeChildId, setActiveChildId] = useState(activeStudentId);
    const pendingStudentSwitchRef = useRef(null);
    const activeChild = students.find(s => s.id === activeChildId) || initialStudent;
    const activeChildName = activeChild?.name || '학생';
    const activeChildSchool = activeChild?.school || '학교 정보 없음';
    const activeChildGrade = activeChild?.grade || '학년 정보 없음';
    const normalizeClassStatus = (value) => {
        if (value === 'withdrawn') return '퇴원';
        if (value === 'active') return '진행중';
        if (value === '재원') return '진행중';
        return value;
    };
    const isWithdrawnStatus = (value) => {
        const normalized = normalizeClassStatus(value);
        return ['퇴원', '중도퇴원', '전반', '전반퇴원'].includes(normalized);
    };
    const toYmd = (value) => {
        if (!value) return null;
        if (typeof value === 'string') return value.slice(0, 10);
        if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
        try {
            return new Date(value).toISOString().slice(0, 10);
        } catch (error) {
            return null;
        }
    };
    const isAfterEndDate = (dateValue, endDateValue) => {
        const date = toYmd(dateValue);
        const endDate = toYmd(endDateValue);
        if (!date || !endDate) return false;
        return date > endDate;
    };
    const isLogAfterClassEndDate = (classId, dateValue) => {
        if (!classId) return false;
        const classStatus = activeChild?.classStatusMap?.[String(classId)] || activeChild?.classStatuses?.[String(classId)];
        const normalizedStatus = normalizeClassStatus(classStatus?.status);
        if (!isWithdrawnStatus(normalizedStatus)) return false;
        const endValue = classStatus?.endedAt || classStatus?.endDate;
        if (!endValue) return false;
        return isAfterEndDate(dateValue, endValue);
    };
    const filteredLessonLogs = useMemo(() => {
        if (!Array.isArray(lessonLogs)) return [];
        return lessonLogs.filter((log) => !isLogAfterClassEndDate(log?.classId, log?.date));
    }, [lessonLogs, activeChild?.classStatusMap, activeChild?.classStatuses]);
    const filteredTests = useMemo(() => {
        if (!Array.isArray(tests)) return [];
        return tests.filter((test) => !isLogAfterClassEndDate(test?.classId, test?.date));
    }, [tests, activeChild?.classStatusMap, activeChild?.classStatuses]);
    const filteredHomeworkAssignments = useMemo(() => {
        if (!Array.isArray(homeworkAssignments)) return [];
        return homeworkAssignments.filter((assignment) => !isLogAfterClassEndDate(assignment?.classId, assignment?.assignedDate || assignment?.date));
    }, [homeworkAssignments, activeChild?.classStatusMap, activeChild?.classStatuses]);

    // 2. 데이터 필터링
    const myClasses = useMemo(() => classes.filter(c => (c.students || []).includes(activeChildId)), [classes, activeChildId]);
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
    const isPaymentFeatureLocked = true;
    const myPayments = useMemo(() => [], []);
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
    const [reportViewMode, setReportViewMode] = useState('overview'); // 'overview' | 'byClass'
    const [learningSubTab, setLearningSubTab] = useState('homework');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [classFilter, setClassFilter] = useState('ongoing'); // 기본: 진행중
    const [expandedSections, setExpandedSections] = useState({ homework: false, grades: false });
    const [showAttendanceDetail, setShowAttendanceDetail] = useState(false);
    const [selectedReportId, _setSelectedReportId] = useState(readReportFromUrl());

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
    }, [setSearchParams]);

    const setSelectedClassroomId = useCallback((classId, { replace = false } = {}) => {
        const value = classId === null || classId === undefined || classId === '' ? null : String(classId);
        _setSelectedClassroomId(value);
        // classroom 선택은 report 탭 컨텍스트
        if (value) _setActiveTab('report');

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
    }, [setSearchParams]);

    const setSelectedReportId = useCallback((reportId, { replace = false } = {}) => {
        const value = reportId === null || reportId === undefined || reportId === '' ? null : String(reportId);
        _setSelectedReportId(value);
        // report 선택은 report 탭 컨텍스트
        if (value) _setActiveTab('report');

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
    }, [setSearchParams]);


    const isParent = true;

    const lessonSectionRef = useRef(null);
    const clinicSectionRef = useRef(null);
    const classStatusRef = useRef(null);

    const [attendanceDetailTarget, setAttendanceDetailTarget] = useState(null);
    const [clinicPageSize, setClinicPageSize] = useState(100);
    const [lessonPageSize, setLessonPageSize] = useState(15);
    const [lessonReportClassFilter, setLessonReportClassFilter] = useState('all');
    const [showAllLessonReports, setShowAllLessonReports] = useState(false);
    const [openClinicCommentIds, setOpenClinicCommentIds] = useState(() => new Set());


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

    const scrollToSection = (ref) => {
        if (ref?.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    useEffect(() => {
        setActiveChildId(activeStudentId);
        setSelectedClassroomId(null, { replace: true });
        setSelectedClassId(null);
        setSelectedReportId(null, { replace: true });
        setExpandedSections({ homework: false, grades: false });
        setShowAttendanceDetail(false);
        setReportViewMode('overview');
        setClassFilter('ongoing');
        setActiveTab('home', { replace: true });
        setClinicPageSize(100);
        setLessonPageSize(15);
    }, [activeStudentId]);

    useEffect(() => {
        if (activeTab === 'report') {
            setReportViewMode('overview');
            setSelectedClassId(null);
            setExpandedSections({ homework: false, grades: false });
            setLessonPageSize(15);
        }
    }, [activeTab]);

    // 알림 관련
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [visibleNotices, setVisibleNotices] = useState([]); 
    const viewerUid = activeChild?.authUid || userId;
    const { notifications, hasUnread, unreadCount, lastReadAt, isLoading, isMetaLoading, setNotifications } = useNotifications(viewerUid);

    const buildClinicTeacher = useCallback((log) => (
        log?.tutorName || log?.tutor || log?.teacherName || log?.teacher || '-'
    ), []);

    const buildClinicComment = useCallback((log) => getClinicComment(log), []);

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

    useEffect(() => {
        if (!activeChild) return;
        let combinedNotices = Array.isArray(notices) ? [...notices] : [];

        setVisibleNotices(combinedNotices);
        }, [notices, activeChildId, unpaidPayments.length, activeChildName, activeChild]);

    const pendingHomeworkCount = useMemo(
        () => myHomeworkStats.filter(h => !h.isComplete).length,
        [myHomeworkStats]
    );

    const toDateValue = (value) => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate();
        if (value instanceof Date) return value;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatAssignedDate = (value) => {
        const date = toDateValue(value);
        return date ? date.toISOString().slice(0, 10) : null;
    };

    const latestGrade = useMemo(() => {
        if (!myGradeComparison || myGradeComparison.length === 0) return null;
        const sorted = [...myGradeComparison].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
        return sorted[sorted.length - 1];
    }, [myGradeComparison]);

    const latestGradeScore = useMemo(
        () => latestGrade ? formatGradeScoreText(latestGrade.grade, latestGrade.totalScore) : null,
        [latestGrade]
    );

    const nextClass = useMemo(() => {
        if (!ongoingClasses || ongoingClasses.length === 0) return null;
        const getFirstStart = (cls) => {
            const schedule = normalizeClassSchedule(cls);
            const first = Object.keys(schedule).sort((x, y) => ['mon','tue','wed','thu','fri','sat','sun'].indexOf(x) - ['mon','tue','wed','thu','fri','sat','sun'].indexOf(y))[0];
            return first ? schedule[first].start : '99:99';
        };
        const sorted = [...ongoingClasses].sort((a, b) => String(getFirstStart(a) || '').localeCompare(String(getFirstStart(b) || '')));
        return sorted[0];
    }, [ongoingClasses]);

    const noticePreview = useMemo(() => visibleNotices.slice(0, 3), [visibleNotices]);

    const handleNotificationClick = async (notification) => {
        const targetStudentId = notification?.studentId;
        const canSwitchStudent = targetStudentId
            && targetStudentId !== activeStudentId
            && Array.isArray(studentIds)
            && studentIds.includes(targetStudentId);

        if (canSwitchStudent) {
            await setActiveStudentId(targetStudentId);
            await waitForActiveStudentSwitch(targetStudentId);
        }

        await openNotification({
            notification,
            onNavigate: ({ refCollection, refId }) => {
                setSelectedClassId(null);
                if (refCollection === 'lessonLogs') {
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

                if (refCollection === 'chats') {
                    setActiveTab('menu');
                }
            },
        });
        setIsNotificationOpen(false);
    };

    const handleMarkAllRead = async () => {
        console.log('[notifications] markAllRead clicked');

        if (!viewerUid) {
            console.warn('[notifications] no viewerUid');
            return;
        }

        try {
            const q = query(
                collection(db, 'notifications', viewerUid, 'items'),
                where('isRead', '==', false)
            );

            const snap = await getDocs(q);
            console.log('[notifications] unread docs =', snap.size);

            if (snap.empty) return;

            const batch = writeBatch(db);
            snap.docs.forEach((d) => {
                batch.update(doc(db, 'notifications', viewerUid, 'items', d.id), {
                    isRead: true,
                    readAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            });

            await batch.commit();
            console.log('[notifications] markAllRead committed');

            // UI 즉시 반영
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt || new Date() }))
            );
        } catch (e) {
            console.error('[notifications] FAIL: markAllRead', e);
            // ✅ 권한 문제여도 페이지 전체가 깨지지 않게 함
        }
    };

    const childAttendanceLogs = useMemo(() => {
        const targetStudentId = String(activeChildId || '');
        const targetStudentUid = String(activeChild?.studentUid || activeChild?.uid || '');
        const targetAuthUid = String(activeChild?.authUid || '');

        return attendanceLogs
            .filter((log) => {
                if (targetStudentId && String(log?.studentId || '') === targetStudentId) return true;
                if (targetStudentUid && String(log?.studentUid || '') === targetStudentUid) return true;
                if (targetAuthUid && String(log?.authUid || '') === targetAuthUid) return true;
                return false;
            })
            .sort((a, b) => new Date(b.date || b.createdAt || b.updatedAt || 0) - new Date(a.date || a.createdAt || a.updatedAt || 0));
    }, [attendanceLogs, activeChildId, activeChild?.studentUid, activeChild?.uid, activeChild?.authUid]);

    const myLessonLogs = useMemo(() => {
        const myClassIds = myClasses.map(c => c.id);
        return filteredLessonLogs
            .filter(log => myClassIds.includes(log.classId))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [filteredLessonLogs, myClasses]);

    const isValidNumber = (n) => typeof n === 'number' && Number.isFinite(n);
    const formatAverage = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num.toFixed(1) : null;
    };

    const isAttendanceMissing = (v) =>
        v == null || String(v).trim() === '' || String(v).includes('미기록');

    const isAbsent = (v) => ['결석', '미출석'].includes(String(v || '').trim());

    const shouldShowHomework = (attendance) => {
        if (isAttendanceMissing(attendance)) return false;
        if (isAbsent(attendance)) return false;
        return true;
    };

    const shouldShowTest = (attendance) => {
        if (isAttendanceMissing(attendance)) return false;
        if (isAbsent(attendance)) return false;
        return true;
    };

    const recentLessons = useMemo(() => {
        const contextData = { lessonLogs: filteredLessonLogs, attendanceLogs, homeworkAssignments: filteredHomeworkAssignments, homeworkResults, tests: filteredTests, grades, classes };
        return myLessonLogs
            .map((log) => {
                const report = generateSessionReport(log.id, activeChildId, contextData);
                const classInfo = classes.find((c) => String(c.id) === String(log.classId));
                return {
                    id: log.id,
                    classId: log.classId,
                    date: log.date,
                    className: classInfo?.name || '수업',
                    teacher: classInfo?.teacher || '담당 선생님',
                    comment: report?.learningComment || report?.progressTopic || log.progress || '수업 기록을 준비 중입니다.',
                    attendance: report?.attendance || '기록 없음',
                    homeworkStatus: report?.homeworkStatus || '과제 없음',
                    testStatus: (() => {
                        const v = report?.testScore;

                        // 1) 테스트 데이터 자체가 없는 경우
                        if (v === null || v === undefined || v === '') {
                            return '테스트 없음';
                        }

                        // 2) 문자열로 'null점' / 'null' 이 들어오는 케이스 방어
                        if (typeof v === 'string' && v.includes('null')) {
                            return '미응시';
                        }

                        // 3) report에 미응시 여부가 명시적으로 있는 경우
                        if (report?.testAttempted === false || report?.testStatus === '미응시') {
                            return '미응시';
                        }

                        // 4) 정상 점수
                        return v;
                    })(),
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [myLessonLogs, activeChildId, filteredLessonLogs, attendanceLogs, filteredHomeworkAssignments, homeworkResults, filteredTests, grades, classes]);

    const resolvedSelectedClassId = String(selectedClassId || '');

    const attendanceHistory = useMemo(() => {
        const list = Array.isArray(childAttendanceLogs) ? childAttendanceLogs : [];
        const cid = String(resolvedSelectedClassId || '');

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

        const filtered = cid
            ? list.filter((log) => getClassId(log) === cid)
            : list;

        const items = filtered
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
    }, [childAttendanceLogs, resolvedSelectedClassId]);

    useEffect(() => {
        if (!showAttendanceDetail) return;
        console.log('[parent] selectedClassId=', resolvedSelectedClassId);
        console.log('[parent] recentLessons size=', Array.isArray(recentLessons) ? recentLessons.length : 0);
        console.log('[parent] attendanceHistory size=', attendanceHistory.length);
        if (Array.isArray(recentLessons) && recentLessons.length) {
            console.log('[parent] sample recentLessons[0]=', recentLessons[0]);
        }
    }, [showAttendanceDetail, resolvedSelectedClassId, recentLessons, attendanceHistory]);

    const recentLessonsToShow = useMemo(
        () => recentLessons.slice(0, lessonPageSize),
        [recentLessons, lessonPageSize],
    );

    const getClassBadge = useCallback((cls) => {
        const classId = String(cls?.id || cls?.classId || '');
        const statusValue = normalizeClassStatus(studentClassStatusMap?.[classId]);
        if (isWithdrawnStatus(statusValue)) return '퇴원';

        const end = cls?.endDate || cls?.endAt || cls?.finishedAt;
        if (end) {
            const date = typeof end === 'string'
                ? new Date(end)
                : (typeof end?.toDate === 'function' ? end.toDate() : new Date(end));
            if (!Number.isNaN(date.getTime()) && date.getTime() < Date.now()) return '종강';
        }

        return '진행중';
    }, [isWithdrawnStatus, normalizeClassStatus, studentClassStatusMap]);

    const getClassBadgeClassName = (status) => {
        if (status === '퇴원') {
            return 'bg-red-50 text-red-700 border border-red-100';
        }
        if (status === '종강') {
            return 'bg-gray-50 text-gray-600 border border-gray-200';
        }
        return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
    };

    const filteredClasses = useMemo(() => {
        if (classFilter === 'withdrawn') return withdrawnClasses;
        if (classFilter === 'finished') return finishedClasses;
        return ongoingClasses;
    }, [classFilter, ongoingClasses, withdrawnClasses, finishedClasses]);

    const classList = useMemo(() => {
        const lessonsByClass = recentLessons.reduce((acc, cur) => {
            acc[cur.classId] = acc[cur.classId] || [];
            acc[cur.classId].push(cur.date);
            return acc;
        }, {});

        const build = (cls) => {
            const latestLessonDate = myLessonLogs.find((log) => log.classId === cls.id)?.date || lessonsByClass[cls.id]?.[0];
            return {
                id: cls.id,
                name: cls.name,
                teacher: cls.teacher,
                status: getClassBadge(cls),
                latestLessonDate: latestLessonDate || '기록 없음',
            };
        };

        return orderedClasses.map((cls) => build(cls));
    }, [orderedClasses, recentLessons, myLessonLogs, getClassBadge]);

    const filteredClassList = useMemo(() => {
        const filteredIds = new Set(filteredClasses.map((cls) => String(cls?.id || cls?.classId || '')));
        return classList.filter((cls) => filteredIds.has(String(cls?.id || '')));
    }, [classList, filteredClasses]);

    const homeworkBySelectedClass = useMemo(() => {
        if (!selectedClassId) return [];
        return myHomeworkStats
            .filter((hw) => String(hw.classId) === String(selectedClassId))
            .map((hw) => ({
                id: hw.id,
                title: hw.content || hw.title || '과제',
                completionRate: hw.completionRate,
                status: hw.status,
                classAverage: hw.classAverage,
                assignedDate: formatAssignedDate(hw.assignedDate || hw.assignedAt || hw.date || hw.createdAt),
                lastCheckedDate: formatAssignedDate(hw.lastCheckedDate),
            }));
    }, [myHomeworkStats, selectedClassId]);

    const testsBySelectedClass = useMemo(() => {
        if (!selectedClassId) return [];
        return (filteredTests || [])
            .filter((test) => String(test.classId) === String(selectedClassId))
            .map((test) => {
                const studentRecord = grades?.[activeChildId]?.[test.id] || {};
                const studentScore = studentRecord.score ?? studentRecord.result ?? null;
                const stats = classTestStats?.[test.id] || classTestStats?.[`${test.classId}_${test.id}`] || null;
                const attemptedCount = Number.isFinite(stats?.attemptedCount)
                    ? stats.attemptedCount
                    : Number.isFinite(stats?.count)
                        ? stats.count
                        : null;
                const classAverage = Number.isFinite(stats?.average)
                    ? stats.average
                    : (test.average ?? test.classAverage ?? null);
                const classMax = Number.isFinite(stats?.maxScore) ? stats.maxScore : null;
                return {
                    id: test.id,
                    name: test.name || '시험',
                    date: test.date,
                    studentScore,
                    classAverage,
                    classMax,
                    attemptedCount,
                    stats,
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [filteredTests, grades, activeChildId, selectedClassId, classTestStats]);

    // ✅ 리포트 데이터 생성 (현재 선택된 리포트 ID가 있을 때만)
    const activeReport = useMemo(() => {
        if (!selectedReportId) return null;
        const contextData = { lessonLogs: filteredLessonLogs, attendanceLogs, homeworkAssignments: filteredHomeworkAssignments, homeworkResults, tests: filteredTests, grades, classes };
        return generateSessionReport(selectedReportId, activeChildId, contextData);
    }, [selectedReportId, activeChildId, filteredLessonLogs, attendanceLogs, filteredHomeworkAssignments, homeworkResults, filteredTests, grades, classes]);

    const sentLessonReports = useMemo(() => (Array.isArray(lessonReports) ? lessonReports : [])
        .filter((report) => report?.status === 'sent' && String(report?.studentId || '') === String(activeChildId || ''))
        .map((report) => ({ ...report, className: classes.find((c) => String(c.id) === String(report.classId))?.name || report.classId }))
        .sort((a, b) => String(b.lessonDate || '').localeCompare(String(a.lessonDate || ''))), [lessonReports, activeChildId, classes]);
    const lessonReportsBySelectedClass = useMemo(() => {
        if (!selectedClassId) return [];
        return sentLessonReports.filter((report) => String(report.classId) === String(selectedClassId));
    }, [selectedClassId, sentLessonReports]);
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

    const navItems = [
        { id: 'home', icon: 'home', label: '홈' },
        { id: 'report', icon: 'clipboardCheck', label: '수업리포트' },
        { id: 'learning', icon: 'bookOpen', label: '학습관리' },
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

    return (
        <div className="bg-gray-50 min-h-screen flex flex-col relative font-sans">
            {/* 헤더 & 자녀 선택 */}
            <div className="bg-white sticky top-0 z-30 shadow-sm">
                <div className="bg-[radial-gradient(circle_at_15%_30%,rgba(56,189,248,0.18),transparent_35%),linear-gradient(135deg,#0f172a,#1e3a8a)] text-white px-4 py-2 flex justify-between items-center text-xs font-bold">
                    <span>학부모 전용</span>
                    <span className="opacity-80">{activeChildSchool} {activeChildGrade}</span>
                </div>
                <StudentHeader />
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <span className="text-xs text-gray-400">현재 자녀</span>
                        <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                            {activeChildName}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setIsNotificationOpen(true)} className="relative p-2 rounded-lg border border-gray-200 text-gray-600">
                            <NotificationsIcon style={{ fontSize: 20 }} />
                            {hasUnread && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
                        </button>
                        <button type="button" onClick={() => setActiveTab('more')} className="relative p-2 rounded-lg border border-gray-200 text-gray-600">
                            <ChatBubbleOutlineIcon style={{ fontSize: 20 }} />
                        </button>
                    </div>
                </div>
            </div>

            <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24 overflow-y-auto custom-scrollbar md:max-w-7xl">
                {/* [라우팅 분기 1] 리포트 상세 화면 */}
                {selectedReportId ? (
                    <ParentSessionReport
                        report={activeReport}
                        onBack={() => setSelectedReportId(null)}
                    />
                ) : selectedClassroomId ? (
                    /* [라우팅 분기 2] 강의실 화면 */
                    <ParentClassroomView 
                        cclasses={classes} lessonLogs={filteredLessonLogs} attendanceLogs={attendanceLogs}
                        selectedClassId={selectedClassroomId} setSelectedClassId={setSelectedClassroomId}
                        videoProgress={videoProgress} homeworkAssignments={filteredHomeworkAssignments} homeworkResults={homeworkResults}
                        tests={filteredTests} grades={grades}
                        onNavigateToTab={() => { setSelectedClassroomId(null); setActiveTab('report'); }}
                        onOpenReport={(sessionId) => setSelectedReportId(sessionId)}
                        activeStudentName={activeChildName}
                    />
                ) : (
                    /* [라우팅 분기 3] 메인 */
                    <div className="animate-fade-in space-y-4">
                        {activeTab === 'home' && (
                            <div className="space-y-4">
                                <section className="bg-[radial-gradient(ellipse_at_18%_25%,rgba(56,189,248,0.28),transparent_40%),radial-gradient(ellipse_at_82%_20%,rgba(45,212,191,0.24),transparent_40%),linear-gradient(135deg,#0a1434,#1d4ed8,#0d9488)] text-white rounded-3xl p-6 md:p-8 shadow-lg border border-sky-900/40">
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                                        <div className="space-y-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-sky-200 font-semibold">학부모 홈</p>
                                            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{activeChildName} 학습 현황</h2>
                                            <p className="text-sm text-sky-100">오늘 바로 확인해야 할 과제와 일정 정보를 한눈에 모았습니다.</p>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="bg-white/10 border border-white/20 text-sky-50 px-3 py-1.5 rounded-full text-xs font-semibold">
                                                    {attendanceHistory[0] ? `최근 출결: ${attendanceHistory[0].attendance} (${attendanceHistory[0].date})` : '출결 기록 준비 중'}
                                                </span>
                                                <span className="bg-white/10 border border-white/20 text-sky-50 px-3 py-1.5 rounded-full text-xs font-semibold">
                                                    미제출 과제 {pendingHomeworkCount}건
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 lg:w-[360px]">
                                            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur">
                                                <p className="text-xs text-sky-100 font-semibold mb-1">다음 수업</p>
                                                {nextClass ? (
                                                    <>
                                                        <p className="text-lg font-bold text-white">{nextClass.name}</p>
                                                        <p className="text-sm text-sky-100 mt-1">{formatClassScheduleKo(nextClass) || '시간 미정'}</p>
                                                        <p className="text-xs text-sky-100/80 mt-2">{nextClass.teacher} 선생님</p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm text-sky-100">등록된 일정이 없습니다.</p>
                                                )}
                                            </div>
                                            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur">
                                                <p className="text-xs text-sky-100 font-semibold mb-1">최근 성적</p>
                                                {latestGrade ? (
                                                    <>
                                                        <p className="text-lg font-bold text-white">{latestGrade.testName}</p>
                                                        <p className="text-sm text-sky-100 mt-1">
                                                            점수 {latestGradeScore?.scoreText}
                                                            {latestGradeScore?.scoreText !== '-' && latestGradeScore?.scoreText !== '미응시' && '점'}
                                                            {formatAverage(latestGrade.classAverage) !== null && ` / 반 평균 ${formatAverage(latestGrade.classAverage)}점`}
                                                        </p>
                                                        <p className="text-xs text-sky-100/80 mt-2">{latestGrade.testDate}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm text-sky-100">등록된 시험 기록이 없습니다.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-6">
                                        <button onClick={() => setActiveTab('report')} className="bg-white text-sky-950 px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 transition-transform">수업 리포트 보기</button>
                                        <button onClick={() => setActiveTab('schedule')} className="bg-blue-900/70 border border-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-800/80 transition-colors">일정 확인</button>
                                        <button onClick={() => setActiveTab('learning')} className="bg-blue-900/70 border border-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-800/80 transition-colors">학습 관리</button>
                                    </div>
                                </section>
                                <section className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: '출결 상세보기', subTab: 'attendance' },
                                        { label: '과제 상세보기', subTab: 'homework' },
                                        { label: '성적 상세보기', subTab: 'grades' },
                                        { label: '클리닉 상세보기', subTab: 'clinic' },
                                    ].map((item) => (
                                        <button key={item.label} onClick={() => { setLearningSubTab(item.subTab); setActiveTab('learning'); }} className="bg-white border border-gray-200 rounded-2xl p-4 text-sm font-bold text-gray-800 text-left">
                                            {item.label}
                                        </button>
                                    ))}
                                </section>

                                <div className="grid gap-4 lg:grid-cols-3">
                                    <div className="space-y-4 lg:col-span-2">
                                        <ParentDashboard 
                                            child={activeChild} myClasses={myClasses} attendanceLogs={attendanceLogs} 
                                            homeworkStats={myHomeworkStats} gradeComparison={myGradeComparison} 
                                            clinicLogs={clinicLogs} unpaidPayments={unpaidPayments}
                                            setActiveTab={setActiveTab}
                                            childClassExitMap={childClassExitMap}
                                            activeChildId={activeChildId}
                                            closures={closures}
                                        />
                                    </div>
                                    <aside className="space-y-4">
                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                    <Icon name="bell" className="w-4 h-4 text-indigo-600" />
                                                    공지사항
                                                </h3>
                                                <button onClick={() => setActiveTab('more')} className="text-xs text-indigo-600 font-semibold hover:underline">전체 보기</button>
                                            </div>
                                            <div className="space-y-2">
                                                {noticePreview.length > 0 ? noticePreview.map(notice => (
                                                    <button 
                                                        key={notice.id} 
                                                        onClick={() => setActiveTab('more')}
                                                        className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                                                    >
                                                        <p className="text-sm font-bold text-gray-900">{notice.title}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{notice.content}</p>
                                                        <p className="text-[11px] text-gray-400 mt-1">{notice.author || '채수용 수학'} • {notice.date}</p>
                                                    </button>
                                                )) : (
                                                    <p className="text-xs text-gray-500 py-2">새로운 알림이 없습니다.</p>
                                                )}
                                            </div>
                                        </div>

                                    </aside>
                                </div>
                            </div>
                        )}

                        {activeTab === 'report' && (
                            <div className="space-y-6">
                                {reportViewMode === 'overview' && (
                                    <>
                                    <section className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                    <Icon name="clipboardCheck" className="w-5 h-5 text-indigo-600" />
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
                                                        ? 'text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100'
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
                                                            ? 'text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100'
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
                                                        {Array.isArray(report?.testSummary?.text) && report.testSummary.text.length > 0 && (
                                                            <div className="text-sm text-gray-700">
                                                                <p className="font-semibold">시험</p>
                                                                <ul className="list-disc pl-5">
                                                                    {report.testSummary.text.map((line, index) => (
                                                                        <li key={`report-test-${report.id}-${index}`}>{line}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {report.comment && <p className="text-sm text-indigo-700">코멘트: {report.comment}</p>}
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
                                        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-[0.2em]">수업 리포트</p>
                                                    <h2 className="text-2xl font-extrabold text-gray-900">{activeChildName} 리포트</h2>
                                                    <p className="text-sm text-gray-600">최근 기록 위주로 빠르게 확인하세요.</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setReportViewMode('byClass');
                                                        setSelectedClassId(null);
                                                        setExpandedSections({ homework: false, grades: false });
                                                        setShowAttendanceDetail(false);
                                                    }}

                                                    className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 hover:bg-indigo-100"
                                                >
                                                    클래스별 기록 보기
                                                </button>
                                            </div>
                                        <div className="space-y-3" ref={lessonSectionRef}>
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                        <Icon name="clipboard" className="w-5 h-5 text-indigo-600" />
                                                        최근 수업 리포트
                                                    </h3>
                                                    <span className="text-xs text-gray-400 font-semibold">
                                                        {Math.min(recentLessonsToShow.length, recentLessons.length)} / {recentLessons.length}
                                                    </span>
                                                </div>
                                                <div className="space-y-3">
                                                    {recentLessonsToShow.map((lesson) => (
                                                        <div key={lesson.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="space-y-1 min-w-0">
                                                                    <p className="text-[11px] text-gray-400 font-semibold">{lesson.date} • {lesson.className}</p>
                                                                    <p className="text-sm text-gray-500">{lesson.teacher} 선생님</p>
                                                                    <p className="text-base font-bold text-gray-900 line-clamp-2">{lesson.comment}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                <StatusPill icon="user" label={lesson.attendance} tone={['결석', '지각'].includes(lesson.attendance) ? 'warning' : 'info'} />
                                                                <StatusPill
                                                                    icon="fileText"
                                                                    label={shouldShowHomework(lesson.attendance) ? (lesson.homeworkStatus ?? '과제 정보 없음') : '과제 없음'}
                                                                    tone={shouldShowHomework(lesson.attendance) && ['미제출', '숙제 출제'].includes(lesson.homeworkStatus) ? 'warning' : 'default'}
                                                                />
                                                                <StatusPill
                                                                    icon="edit"
                                                                    label={shouldShowTest(lesson.attendance) ? (lesson.testStatus ?? '시험 정보 없음') : '시험 없음'}
                                                                    tone={shouldShowTest(lesson.attendance) && lesson.testStatus === '미응시' ? 'warning' : 'default'}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {recentLessons.length === 0 && (
                                                        <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                            아직 작성된 수업 리포트가 없습니다.
                                                        </div>
                                                    )}
                                                    {recentLessonsToShow.length < recentLessons.length && (
                                                        <div className="px-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setLessonPageSize((v) => v + 15)}
                                                                className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-200 active:scale-95 transition"
                                                            >
                                                                더 보기
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        <section ref={clinicSectionRef} className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                    <Icon name="activity" className="w-5 h-5 text-indigo-600" />
                                                    클리닉 리포트
                                                </h3>
                                                <span className="text-xs text-gray-400 font-semibold">{Math.min(visibleCompletedClinics.length, completedClinics.length)} / {completedClinics.length}</span>
                                            </div>
                                            <div className="space-y-3">
                                                {visibleCompletedClinics.map((log) => {
                                                    const commentKey = log.id ?? `${log.date}-${log.checkIn || log.checkOut || 'clinic'}`;
                                                    const isOpen = openClinicCommentIds.has(commentKey);
                                                    const hasComment = Boolean(log.commentResolved);
                                                    const isNoShow = log.displayStatus === '미참석';
                                                    const commentPreview = hasComment
                                                        ? (log.commentResolved.length > 60 ? `${log.commentResolved.slice(0, 60)}...` : log.commentResolved)
                                                        : '';
                                                    const timeLabel = log.checkIn
                                                        ? `${log.checkIn}~${log.checkOut || ''}`
                                                        : (log.checkOut ? `~${log.checkOut}` : '시간 미정');
                                                    return (
                                                        <div key={commentKey} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="space-y-1">
                                                                    <p className="text-[11px] text-gray-400 font-semibold">{log.date} • {timeLabel}</p>
                                                                    <h4 className="font-bold text-gray-900 text-sm">학습 클리닉</h4>
                                                                    <p className="text-xs text-gray-500">{log.teacherResolved}</p>
                                                                </div>
                                                                <StatusPill
                                                                    icon="clock"
                                                                    label={log.displayStatus}
                                                                    tone={log.displayStatus === '미참석' ? 'danger' : 'info'}
                                                                />
                                                            </div>
                                                            {(hasComment || !isNoShow) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setOpenClinicCommentIds((prev) => {
                                                                            const next = new Set(prev);
                                                                            if (next.has(commentKey)) next.delete(commentKey);
                                                                            else next.add(commentKey);
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full hover:bg-indigo-100 active:scale-95 transition"
                                                                >
                                                                    {isOpen ? (isNoShow ? '사유 닫기' : '코멘트 닫기') : (isNoShow ? '사유 보기' : '코멘트 보기')}
                                                                </button>
                                                            )}
                                                            {isOpen && (
                                                                <MathText
                                                                    text={log.commentResolved || (isNoShow ? '미참석 사유가 아직 작성되지 않았습니다.' : '코멘트가 아직 작성되지 않았습니다.')}
                                                                    className="mt-1 text-sm text-gray-700 break-words"
                                                                    inlineTextClassName="text-sm text-gray-700 break-words"
                                                                />
                                                            )}
                                                        </div>
                                                        );
                                                })}
                                                {completedClinics.length === 0 && (
                                                    <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                        아직 클리닉 기록이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                            {visibleCompletedClinics.length < completedClinics.length && (
                                                <div className="px-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setClinicPageSize((v) => v + 100)}
                                                        className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-200 active:scale-95 transition"
                                                    >
                                                        더 보기
                                                    </button>
                                                </div>
                                            )}
                                            </section>

                                        <section ref={classStatusRef} className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                    <Icon name="barChart" className="w-5 h-5 text-indigo-600" />
                                                    클래스 목록
                                                </h3>
                                                <span className="text-xs text-gray-400 font-semibold">총 {classList.length}개 반</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                {classList.map((cls) => (
                                                    <button
                                                        key={cls.id}
                                                        onClick={() => {
                                                            setReportViewMode('byClass');
                                                            setSelectedClassId(cls.id);
                                                            setExpandedSections({ homework: false, grades: false });
                                                            setShowAttendanceDetail(false);
                                                        }}
                                                        className="text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3 hover:border-indigo-200 transition"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="space-y-1">
                                                                <p className="text-[11px] text-gray-400 font-semibold">{cls.latestLessonDate}</p>
                                                                <h4 className="font-bold text-gray-900">{cls.name}</h4>
                                                                <p className="text-xs text-gray-500">{cls.teacher} 선생님</p>
                                                            </div>
                                                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${getClassBadgeClassName(cls.status)}`}>
                                                                {cls.status}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                                {classList.length === 0 && (
                                                    <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                        등록된 반이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </>
                                )}
                                {reportViewMode === 'byClass' && (
                                    <>
                                        {!selectedClassId && (
                                            <section className="space-y-3">
                                                <div className="flex items-center justify-between px-1">
                                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                        <Icon name="barChart" className="w-5 h-5 text-indigo-600" />
                                                        클래스별 기록 보기
                                                    </h3>
                                                    <button
                                                        onClick={() => {
                                                            setReportViewMode('overview');
                                                            setExpandedSections({ homework: false, grades: false });
                                                            setShowAttendanceDetail(false);
                                                        }}
                                                        className="text-xs text-gray-500 underline"
                                                    >
                                                        수업 리포트로 돌아가기
                                                    </button>
                                                </div>
                                                <div className="flex gap-2 mb-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setClassFilter('ongoing')}
                                                        className={classFilter === 'ongoing'
                                                            ? 'text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100'
                                                            : 'text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200'}
                                                    >
                                                        진행중
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setClassFilter('withdrawn')}
                                                        className={classFilter === 'withdrawn'
                                                            ? 'text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100'
                                                            : 'text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200'}
                                                    >
                                                        퇴원
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setClassFilter('finished')}
                                                        className={classFilter === 'finished'
                                                            ? 'text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100'
                                                            : 'text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200'}
                                                    >
                                                        종강
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                    {filteredClassList.map((cls) => (
                                                        <button
                                                            key={cls.id}
                                                            onClick={() => {
                                                                setSelectedClassId(cls.id);
                                                                setExpandedSections({ homework: false, grades: false });
                                                                setShowAttendanceDetail(false);
                                                            }}
                                                            className="text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3 hover:border-indigo-200 transition"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="space-y-1">
                                                                    <p className="text-[11px] text-gray-400 font-semibold">{cls.latestLessonDate}</p>
                                                                    <h4 className="font-bold text-gray-900">{cls.name}</h4>
                                                                    <p className="text-xs text-gray-500">{cls.teacher} 선생님</p>
                                                                </div>
                                                                <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${getClassBadgeClassName(cls.status)}`}>
                                                                    {cls.status}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {filteredClassList.length === 0 && (
                                                        <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 md:col-span-2 xl:col-span-3">
                                                            선택한 상태의 클래스가 없습니다.
                                                        </div>
                                                    )}
                                                </div>
                                            </section>
                                        )}

                                        {selectedClassId && (
                                            <section className="space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedClassId(null);
                                                                setExpandedSections({ homework: false, grades: false });
                                                                setShowAttendanceDetail(false);
                                                            }}
                                                            className="text-xs text-gray-600 hover:underline flex items-center gap-1"
                                                        >
                                                            <Icon name="chevronLeft" className="w-4 h-4" /> 전체 반 목록으로 돌아가기
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setReportViewMode('overview');
                                                                setSelectedClassId(null);
                                                                setExpandedSections({ homework: false, grades: false });
                                                                setShowAttendanceDetail(false);
                                                            }}
                                                            className="text-xs text-gray-400 underline"
                                                        >
                                                            수업 리포트로 돌아가기
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                        <Icon name="clipboard" className="w-5 h-5 text-indigo-600" />
                                                        클래스 수업 리포트
                                                    </h3>
                                                    <div className="space-y-3">
                                                        {lessonReportsBySelectedClass.map((report) => (
                                                            <div key={report.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
                                                                <p className="text-[11px] text-gray-400 font-semibold">{report.lessonDate} • {report.className}</p>
                                                                {report.learnedTopics && <p className="text-sm text-gray-700">진도: {report.learnedTopics}</p>}
                                                                {report.attendanceStatus && <p className="text-sm text-gray-700">출결: {report.attendanceStatus}</p>}
                                                                {Array.isArray(report?.homeworkSummary?.text) && report.homeworkSummary.text.length > 0 && <p className="text-sm text-gray-700">과제 수행: {report.homeworkSummary.text.join(' · ')}</p>}
                                                                {Array.isArray(report?.testSummary?.text) && report.testSummary.text.length > 0 && (
                                                            <div className="text-sm text-gray-700">
                                                                <p className="font-semibold">시험</p>
                                                                <ul className="list-disc pl-5">
                                                                    {report.testSummary.text.map((line, index) => (
                                                                        <li key={`report-test-${report.id}-${index}`}>{line}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                                {report.comment && <p className="text-sm text-indigo-700">코멘트: {report.comment}</p>}
                                                            </div>
                                                        ))}
                                                        {lessonReportsBySelectedClass.length === 0 && (
                                                            <div className="p-6 text-center bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
                                                                이 반의 수업 리포트가 없습니다.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                    <button
                                                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                                                        onClick={() => setShowAttendanceDetail((v) => !v)}
                                                    >
                                                        <span className="text-sm font-bold text-gray-900">출결 상세</span>
                                                        <Icon name={showAttendanceDetail ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    {showAttendanceDetail && (
                                                        <div className="p-4">
                                                            <div className="mt-3 space-y-2">
                                                                {attendanceHistory.length === 0 ? (
                                                                    <div className="text-sm text-gray-500">
                                                                        출결 기록이 없습니다.
                                                                    </div>
                                                                ) : (
                                                                    attendanceHistory.map(item => (
                                                                        <div
                                                                            key={item.id}
                                                                            className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                                                                        >
                                                                            <div className="text-sm font-semibold text-gray-800">
                                                                                {item.date || '(날짜 없음)'} · {item.attendance}
                                                                            </div>

                                                                            {item.memo && (
                                                                                <div className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                                                                                    {item.memo}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                    <button
                                                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                                                        onClick={() => setExpandedSections((prev) => ({ ...prev, homework: !prev.homework }))}
                                                    >
                                                        <span className="text-sm font-bold text-gray-900">과제 상세</span>
                                                        <Icon name={expandedSections.homework ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    {expandedSections.homework && (
                                                        <div className="divide-y divide-gray-100">
                                                            {homeworkBySelectedClass.map((hw) => {
                                                                const hasValidAverage = isValidNumber(hw.classAverage);
                                                                if (!hasValidAverage) {
                                                                    console.error('[ParentReport] homework class average missing', { classId: selectedClassId, assignmentId: hw.id });
                                                                }
                                                                return (
                                                                    <div key={hw.id} className="p-4 space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <div>
                                                                                <p className="text-sm font-bold text-gray-900">{hw.title}</p>
                                                                                <p className="text-xs text-gray-500">{hw.status}</p>
                                                                                <p className="text-[11px] text-gray-400">출제일: {hw.assignedDate || '-'}</p>
                                                                                <p className="text-[11px] text-gray-400">최근 검사일: {hw.lastCheckedDate || '-'}</p>
                                                                            </div>
                                                                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{hw.completionRate}%</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {homeworkBySelectedClass.length === 0 && (
                                                                <div className="p-4 text-sm text-gray-500">과제 기록이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                    <button
                                                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                                                        onClick={() => setExpandedSections((prev) => ({ ...prev, grades: !prev.grades }))}
                                                    >
                                                        <span className="text-sm font-bold text-gray-900">성적 상세</span>
                                                        <Icon name={expandedSections.grades ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    {expandedSections.grades && (
                                                        <div className="divide-y divide-gray-100">
                                                            {testsBySelectedClass.map((test) => {
                                                                const attemptedCount = Number.isFinite(test.attemptedCount) ? test.attemptedCount : null;
                                                                const averageLabel = formatAverage(test.classAverage);
                                                                const hasValidAverage = averageLabel !== null;
                                                                const hasValidMax = isValidNumber(test.classMax);
                                                                const statsText = (() => {
                                                                    if (!test.stats) return '통계 준비 중';
                                                                    if (attemptedCount === 0) return '반 평균 없음';

                                                                    const parts = [];
                                                                    if (hasValidAverage) parts.push(`평균 ${averageLabel}점`);
                                                                    if (hasValidMax) parts.push(`최고 ${test.classMax}점`);

                                                                    return parts.length > 0 ? parts.join(' / ') : '통계 준비 중';
                                                                })();
                                                                return (
                                                                    <div key={test.id} className="p-4 space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <div>
                                                                                <p className="text-sm font-bold text-gray-900">{test.name}</p>
                                                                                <p className="text-xs text-gray-500">{test.date}</p>
                                                                            </div>
                                                                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{test.studentScore ?? '미응시'}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-xs text-gray-600">
                                                                            <span></span>
                                                                            <span>{statsText}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {testsBySelectedClass.length === 0 && (
                                                                <div className="p-4 text-sm text-gray-500">시험 기록이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </section>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'schedule' && (
                            <ScheduleTab 
                                myClasses={myClasses} attendanceLogs={attendanceLogs} clinicLogs={clinicLogs} 
                                externalSchedules={externalSchedules} onSaveExternalSchedule={onSaveExternalSchedule} onDeleteExternalSchedule={onDeleteExternalSchedule}
                                student={activeChild}
                                childClassExitMap={childClassExitMap}
                                closures={closures}
                            />
                        )}

                        {activeTab === 'learning' && <div className="text-sm text-gray-600">학습관리 화면 ({learningSubTab})</div>}

                        {activeTab === 'more' && (
                            <MenuTab student={activeChild} onUpdateStudent={() => {}} onLogout={onLogout} videoMemos={{}} lessonLogs={[]} onLinkToMemo={() => {}} notices={visibleNotices} setActiveTab={setActiveTab} isParent={true} />
                        )}
                    </div>
                )}
            </main>

            {!selectedClassId && !selectedReportId && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.03)] h-[calc(60px+env(safe-area-inset-bottom))]">
                    <div className="max-w-md mx-auto flex justify-around items-center h-[60px] md:max-w-7xl">
                        {navItems.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => setActiveTab(item.id)} 
                                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-95 ${activeTab === item.id ? 'text-indigo-900' : 'text-gray-400 hover:text-gray-600'}`}
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
                <div className={`fixed bottom-24 right-5 z-[60] flex flex-col gap-3 items-center`}>
                    <button
                        onClick={() => setIsNotificationOpen(true)}
                        className="bg-white text-indigo-900 border border-indigo-200 p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-90 flex items-center justify-center relative w-12 h-12"
                    >
                        <NotificationsIcon style={{ fontSize: 24 }} />
                        {hasUnread && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}
                    </button>
                </div>
            )}

            {attendanceDetailTarget && (
                <AttendanceDetailModal
                    isOpen
                    onClose={() => setAttendanceDetailTarget(null)}
                    lesson={attendanceDetailTarget}
                    attendanceLogs={attendanceLogs}
                    studentId={activeChildId}
                />
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
            />
        </div>
    );
}

const StatusPill = ({ icon, label, tone = 'default' }) => {
    const styles = {
        default: 'bg-gray-50 text-gray-700 border-gray-200',
        info: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        warning: 'bg-orange-50 text-orange-700 border-orange-100',
        danger: 'bg-red-50 text-red-700 border-red-100'
    };
    const style = styles[tone] || styles.default;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${style}`}>
            {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
            {label}
        </span>
    );
};

// changed: hide ended classes in today’s lessons