// src/utils/helpers.js
import React from 'react';
import { buildHomeworkQuestionStats, computeHomeworkProgress, getAssignmentQuestionNumbers, isAssignmentAssignedToStudent, isHomeworkCompleteByCounts, normalizeHomeworkResultMapForDisplay } from '../domain/homework/homework.service';
import { isClosedDate, normalizeDateToYMD } from './closures';
import { getTotalScore, isAbsentGrade } from '../domain/grade/grade.service';
import { 
    Home, Calendar, Clipboard, BarChart2, Menu, 
    User, Users, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, 
    CheckCircle, Clock, AlertCircle, X, Check, LogOut,
    Bell, MessageSquare, Video, FileText, Lock,
    Search, Filter, MoreVertical, Plus, Trash2,
    PlayCircle, PauseCircle, StopCircle, Volume2, VolumeX,
    Maximize, Minimize, Settings, BookOpen, PenTool,
    MapPin, Phone, Mail, Award, TrendingUp, TrendingDown, Activity,
    Edit, List, Folder, Download, CreditCard, Smartphone,
    AlertTriangle, MessageCircle, CheckSquare, CalendarPlus,
    RefreshCw, UserX, Eye, Megaphone
} from 'lucide-react';

export const Icon = ({ name, className, ...props }) => {
    const icons = {
        home: Home, calendar: Calendar, clipboard: Clipboard, clipboardCheck: Clipboard, 
        barChart: BarChart2, menu: Menu, user: User, users: Users, 
        chevronRight: ChevronRight, chevronLeft: ChevronLeft, 
        chevronUp: ChevronUp, chevronDown: ChevronDown, 
        checkCircle: CheckCircle, clock: Clock, 
        alertCircle: AlertCircle, x: X, check: Check,
        logOut: LogOut, bell: Bell, messageSquare: MessageSquare, monitor: Video,
        fileText: FileText, lock: Lock, search: Search, filter: Filter,
        moreVertical: MoreVertical, plus: Plus, trash: Trash2,
        play: PlayCircle, pause: PauseCircle, stop: StopCircle,
        volume: Volume2, mute: VolumeX, fullscreen: Maximize, exitFullscreen: Minimize,
        settings: Settings, book: BookOpen, pen: PenTool,
        mapPin: MapPin, phone: Phone, mail: Mail, award: Award,
        activity: Activity, trend: TrendingUp, trendingUp: TrendingUp, trendingDown: TrendingDown, 
        list: Activity, school: Home, pin: MapPin,
        edit: Edit, schedule: List, folder: Folder,
        download: Download, video: Video,
        creditCard: CreditCard, smartphone: Smartphone,
        alertTriangle: AlertTriangle, messageCircle: MessageCircle,
        checkSquare: CheckSquare, calendarPlus: CalendarPlus,
        refreshCw: RefreshCw, userX: UserX, eye: Eye, megaphone: Megaphone
    };
    const LucideIcon = icons[name] || Home;
    return <LucideIcon className={className} {...props} />;
};

export const formatGradeLabel = (grade) => {
    if (grade === null || grade === undefined) return '';
    const raw = grade.toString().trim();
    if (!raw) return '';

    const normalized = raw
        .replace(/^(고)+/, '고')
        .replace(/^(중)+/, '중')
        .replace(/^(초)+/, '초');

    if (/^[고중초]/.test(normalized)) return normalized;
    return `고${normalized}`;
};

export const staffMembers = [
    { id: 'teacher', name: '채수용 선생님', role: 'teacher', avatar: 'C' },
    { id: 'lab', name: '수학 연구소', role: 'admin', avatar: 'Lab' }
];

export const getWeekOfMonth = (date) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDayOfMonth.getDay(); 
    const weekNo = Math.ceil((date.getDate() + dayOfWeek) / 7);
    return { month: date.getMonth() + 1, week: weekNo };
};

// ✅ [수정] Z-Score 추세 판정 로직 (조건: Δ ≥ 0.3σ)
export const calculateTrendZScore = (grades) => {
    // 최근 3회 데이터가 없으면 분석 불가
    if (!grades || grades.length < 3) return 'initial';

    // 날짜순(과거->미래) 정렬된 데이터에서 최근 3개 추출
    const [g1, g2, g3] = grades.slice(-3); 
    
    // Z-score가 하나라도 없으면 계산 불가
    if (g1.zScore === undefined || g2.zScore === undefined || g3.zScore === undefined) return 'initial';

    // 변화량(Delta) 계산
    const delta1 = g2.zScore - g1.zScore; // Z2 - Z1
    const delta2 = g3.zScore - g2.zScore; // Z3 - Z2

    // ✅ 기준값: 0.3 Sigma
    const threshold = 0.3; 

    // 1. 연속 상승: 두 번의 변화량이 모두 +0.3 이상 (Δ ≥ +0.3)
    if (delta1 >= threshold && delta2 >= threshold) {
        return 'up';
    }

    // 2. 연속 하락: 두 번의 변화량이 모두 -0.3 이하 (Δ ≤ -0.3)
    if (delta1 <= -threshold && delta2 <= -threshold) {
        return 'down';
    }

    // 3. 그 외: 유지 중
    return 'same';
};

// ✅ [수정] 성적 비교 및 Z-Score 계산
export const calculateGradeComparison = (studentId, classes, tests, grades, classTestStats = {}) => {
    if (!tests || !grades) return [];

    const myGrades = [];
    const studentKey = String(studentId || '');
    const classList = Array.isArray(classes) ? classes : [];
    const testList = Array.isArray(tests) ? tests : [];
    const hasGradeRecord = (test) => Boolean(grades?.[studentId]?.[test.id]);
    const rosterContainsStudent = (cls = {}) => [
        ...(Array.isArray(cls.students) ? cls.students : []),
        ...(Array.isArray(cls.studentIds) ? cls.studentIds : []),
        ...(Array.isArray(cls.studentDocIds) ? cls.studentDocIds : []),
        ...(Array.isArray(cls.studentAuthUids) ? cls.studentAuthUids : []),
    ].some((value) => String(value) === studentKey);
    const visibleClassIds = classList.map(c => String(c.id || c.classId || c.classDocId || c.docId || '')).filter(Boolean);
    const myClassIds = classList.filter(rosterContainsStudent).map(c => String(c.id));
    const relevantTests = testList.filter(t => visibleClassIds.includes(String(t.classId)) || myClassIds.includes(String(t.classId)) || hasGradeRecord(t));

    const computeScoreFromCorrectCount = (record, test) => {
        if (!record?.correctCount) return null;

        const entries = Object.entries(record.correctCount);
        if (entries.length === 0) return null;

        // 맞음/고침을 정답으로 처리
        const correct = entries.filter(([, v]) => v === '맞음' || v === '고침').length;
        const total = entries.length;

        const maxScore = Number(test?.maxScore) || 0;
        if (maxScore <= 0) return correct; // 만점이 없으면 '맞은 개수'라도 반환

        return Math.round((correct / total) * maxScore);
    };


    relevantTests.forEach(test => {
        const myRecord = grades[studentId]?.[test.id] || null;
        {
            const aggregatedStats = classTestStats?.[`${test.classId}_${test.id}`] || classTestStats?.[test.id] || null;
            const submittedCount = Number(aggregatedStats?.submittedCount ?? aggregatedStats?.attemptedCount ?? aggregatedStats?.count);
            const hasStats = aggregatedStats && Number.isFinite(submittedCount);

            const rawMyScore = myRecord?.score;
            const totalScoreFromService = isAbsentGrade(myRecord) ? null : getTotalScore(myRecord, test);
            const computedMyScore = Number.isFinite(totalScoreFromService)
                ? totalScoreFromService
                : computeScoreFromCorrectCount(myRecord, test);

            const numericRawMyScore = Number(rawMyScore);
            const myScore = Number.isFinite(numericRawMyScore)
                ? numericRawMyScore
                : (Number.isFinite(computedMyScore) ? computedMyScore : null);

            const averageSource = hasStats && Number.isFinite(aggregatedStats.average) ? aggregatedStats.average : null;
            const classAverage = averageSource !== null ? Math.round(averageSource) : null;
            const highestScore = hasStats && Number.isFinite(aggregatedStats.maxScore) ? aggregatedStats.maxScore : null;
            const totalStudents = hasStats ? submittedCount : null;

            const myAccuracy = (Number.isFinite(myScore) && test.maxScore > 0)
                ? Math.round((myScore / test.maxScore) * 100)
                : null;
            const scoreDifference = (classAverage !== null && Number.isFinite(myScore)) ? myScore - classAverage : null;
            const isAboveAverage = (classAverage !== null && Number.isFinite(myScore)) ? myScore >= classAverage : null;

            let zScore;
            
            const stdDevSource = hasStats && Number.isFinite(aggregatedStats.stdDev) ? aggregatedStats.stdDev : test.stdDev;
            const avgForZ = averageSource !== null ? averageSource : test.average;
            if (Number.isFinite(stdDevSource) && stdDevSource > 0 && Number.isFinite(avgForZ) && Number.isFinite(myScore)) {
                zScore = (myScore - avgForZ) / stdDevSource;
            }

            const questionsAnalysis = [];
            if (test.questionScores && myRecord?.correctCount) {
                test.questionScores.forEach((score, idx) => {
                    const qNum = idx + 1;
                    const status = myRecord.correctCount[qNum] || '미응시';
                    const rate = aggregatedStats?.correctRates ? aggregatedStats.correctRates[qNum] : null;
                    const itemAccuracy = Number.isFinite(rate) ? Math.round(rate * 100) : null;

                    questionsAnalysis.push({
                        no: qNum, score: score, status: status, itemAccuracy: itemAccuracy,
                        type: '객관식', difficulty: test.questionAnalysis?.[idx]?.difficulty || '중'
                    });
                });
            }

            myGrades.push({
                testId: test.id, testName: test.name, testDate: test.date,
                classId: test.classId,
                className: classList.find(c => String(c.id) === String(test.classId))?.name || test.className || '반 정보 없음',
                studentScore: Number.isFinite(myScore) ? myScore : null,
                classAverage: classAverage,
                highestScore: highestScore,
                maxScore: test.maxScore,
                accuracy: myAccuracy,
                rank: null,
                totalStudents: totalStudents,
                scoreDifference: scoreDifference,
                isAboveAverage: isAboveAverage,
                questions: questionsAnalysis,
                zScore: zScore, // 계산된 Z-Score 포함
                statsReady: Boolean(hasStats),
                grade: myRecord,
                totalScore: Number.isFinite(myScore) ? myScore : null,
            });
        }
    });

    // 날짜 내림차순 정렬 (최신순)
    return myGrades.sort((a, b) => new Date(b.testDate) - new Date(a.testDate));
};

export const toDateStr = (value) => normalizeDateToYMD(value);

export const isDateInRange = (d, s, e) => {
    const dd = String(d);
    const ss = String(s);
    const ee = String(e);
    return ss <= dd && dd <= ee;
};

export const isClosedForClass = (dateStr, classId, closures = []) => {
    return isClosedDate({ date: dateStr, classId, closures });
};

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const toWeekdayKey = (input) => {
    const v = String(input || '').trim().toLowerCase();
    const map = {
        '월': 'mon', mon: 'mon', monday: 'mon',
        '화': 'tue', tue: 'tue', tuesday: 'tue',
        '수': 'wed', wed: 'wed', wednesday: 'wed',
        '목': 'thu', thu: 'thu', thursday: 'thu',
        '금': 'fri', fri: 'fri', friday: 'fri',
        '토': 'sat', sat: 'sat', saturday: 'sat',
        '일': 'sun', sun: 'sun', sunday: 'sun',
    };
    return map[v] || '';
};

export const formatWeekdayKo = (key) => ({ mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' }[key] || key);

export const isValidTimeHHmm = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || '').trim());

export const normalizeClassSchedule = (cls) => {
    const schedule = cls?.schedule && typeof cls.schedule === 'object' ? cls.schedule : null;
    if (schedule) {
        const out = {};
        Object.keys(schedule).forEach((kRaw) => {
            const k = toWeekdayKey(kRaw);
            const start = String(schedule[kRaw]?.start || '').trim();
            const end = String(schedule[kRaw]?.end || '').trim();
            if (!k || !isValidTimeHHmm(start) || !isValidTimeHHmm(end)) return;
            out[k] = { start, end };
        });
        if (Object.keys(out).length) return out;
    }

    const legacyDays = Array.isArray(cls?.scheduleDays)
        ? cls.scheduleDays.map((d) => Number(d?.day ?? d?.weekday)).filter(Number.isFinite)
        : Array.isArray(cls?.daysOfWeek) ? cls.daysOfWeek
        : Array.isArray(cls?.weekdays) ? cls.weekdays
        : Array.isArray(cls?.days) ? cls.days
        : cls?.dayOfWeek ? [cls.dayOfWeek]
        : cls?.weekday ? [cls.weekday]
        : Array.isArray(cls?.schedule?.days) ? cls.schedule.days
        : [];

    const start = String(cls?.startTime || cls?.start || '').trim();
    const end = String(cls?.endTime || cls?.end || '').trim();
    const scheduleDayMap = Array.isArray(cls?.scheduleDays)
        ? cls.scheduleDays.reduce((acc, item) => {
            const key = toWeekdayKey(item?.day ?? item?.weekday);
            const sTime = String(item?.startTime || item?.start || '').trim();
            const eTime = String(item?.endTime || item?.end || '').trim();
            if (!key || !isValidTimeHHmm(sTime) || !isValidTimeHHmm(eTime)) return acc;
            acc[key] = { start: sTime, end: eTime };
            return acc;
        }, {})
        : {};
    const out = {};
    legacyDays.map(toWeekdayKey).filter(Boolean).forEach((k) => {
        if (scheduleDayMap[k]) {
            out[k] = scheduleDayMap[k];
            return;
        }
        if (isValidTimeHHmm(start) && isValidTimeHHmm(end)) out[k] = { start, end };
    });

    if (!Object.keys(out).length) {
        const time = String(cls?.time || cls?.schedule?.time || '').trim();
        const m = time.match(/([01]\d|2[0-3]):[0-5]\d\s*[~-]\s*([01]\d|2[0-3]):[0-5]\d/);
        if (m) {
            const [s2, e2] = time.split(/[~-]/).map((v) => v.trim());
            legacyDays.map(toWeekdayKey).filter(Boolean).forEach((k) => {
                out[k] = { start: s2, end: e2 };
            });
        }
    }

    return Object.keys(out).length ? out : {};
};

export const getClassWeekdays = (cls) => Object.keys(normalizeClassSchedule(cls))
    .sort((a, b) => WEEKDAY_KEYS.indexOf(a) - WEEKDAY_KEYS.indexOf(b));

export const formatClassScheduleKo = (cls) => {
    const schedule = normalizeClassSchedule(cls);
    const days = getClassWeekdays(cls);
    if (!days.length) return '';
    return days.map((d) => `${formatWeekdayKo(d)} ${schedule[d].start}~${schedule[d].end}`).join(', ');
};


const toYmdSafe = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    try { return new Date(value).toISOString().slice(0, 10); } catch { return null; }
};

export function inDateRange(ymd, startYmd, endYmd) {
    const d = toYmdSafe(ymd);
    if (!d) return false;
    const s = toYmdSafe(startYmd);
    const e = toYmdSafe(endYmd);
    if (s && d < s) return false;
    if (e && d > e) return false;
    return true;
}


const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function isClassActiveOnDate(cls, ymd) {
    if (!cls) return false;
    const d = new Date(`${ymd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;

    const start = cls.startDate ? new Date(`${String(cls.startDate).slice(0, 10)}T00:00:00`) : null;
    const end = cls.endDate ? new Date(`${String(cls.endDate).slice(0, 10)}T23:59:59`) : null;

    if (start && d < start) return false;
    if (end && d > end) return false;

    if (cls.status && String(cls.status).includes('종강')) return false;
    if (cls.active === false) return false;

    return true;
}

export function getClassTimeOnDate(cls, ymd) {
    if (!cls) return null;
    const d = new Date(`${ymd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const dowKey = DOW_KEYS[d.getDay()];

    const ws = cls.weeklySchedule || cls.scheduleByDay || cls.weeklyTimes || cls.schedules || null;
    if (ws && ws[dowKey]) {
        const v = ws[dowKey];
        if (typeof v === 'string') return v;
        const s = v.start || v.startTime;
        const e = v.end || v.endTime;
        if (s && e) return `${s}~${e}`;
        if (v.time) return v.time;
    }

    const schedule = normalizeClassSchedule(cls);
    if (schedule?.[dowKey]?.start && schedule?.[dowKey]?.end) {
        return `${schedule[dowKey].start}~${schedule[dowKey].end}`;
    }

    const scheduleText = String(cls?.schedule?.time || cls?.scheduleTime || cls?.time || '').trim();
    const timeMatch = scheduleText.match(/([01]\d|2[0-3]):[0-5]\d\s*[~-]\s*([01]\d|2[0-3]):[0-5]\d/);
    const normalizedTime = timeMatch ? `${timeMatch[1]}~${timeMatch[2]}` : '';

    const days = Array.isArray(cls.days) ? cls.days : Array.isArray(cls.weekdays) ? cls.weekdays : Array.isArray(cls?.schedule?.days) ? cls.schedule.days : [];
    const dayKeys = days.map((value) => toWeekdayKey(value)).filter(Boolean);
    const dayMatch = dayKeys.includes(dowKey) || days.map(String).includes(String(d.getDay()));
    if (!dayMatch) return null;

    if (normalizedTime) return normalizedTime;
    if (cls.startTime && cls.endTime) return `${cls.startTime}~${cls.endTime}`;
    return null;
}

export function hasClassOnDate(cls, ymd) {
    if (!isClassActiveOnDate(cls, ymd)) return false;
    return Boolean(getClassTimeOnDate(cls, ymd));
}

export const getWeekdayKeyFromDate = (dateInput = new Date()) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return WEEKDAY_KEYS[(safeDate.getDay() + 6) % 7];
};

export const isClassActiveForStudent = ({ cls, student, todayYmd }) => {
    if (!cls?.id) return false;
    const withdrawnStatuses = ['종강', '퇴원', '전반', '전반퇴원', '중도퇴원'];
    const classStatus = student?.classStatusMap?.[cls.id]?.status || student?.classStatuses?.[cls.id];
    if (withdrawnStatuses.includes(String(classStatus || '').trim())) return false;

    const start = cls?.startDate || cls?.openDate || cls?.beginDate || null;
    const end = cls?.endDate || cls?.closeDate || cls?.finishDate || null;
    if (todayYmd && !inDateRange(todayYmd, start, end)) return false;
    return true;
};

export const calculateClassSessions = (cls, closures = []) => {
    if (!cls) return [];
    const normalizedSchedule = normalizeClassSchedule(cls);
    const scheduleDays = Object.keys(normalizedSchedule);
    if (!scheduleDays.length) return [];
    const sessions = [];
    const targetDayIndexes = scheduleDays.map((d) => (WEEKDAY_KEYS.indexOf(d) + 1) % 7);
    const startDateValue = cls?.startDate || cls?.openDate || cls?.beginDate || null;
    const endDateValue = cls?.endDate || cls?.closeDate || cls?.finishDate || null;
    const currentDate = startDateValue ? new Date(startDateValue) : new Date();
    const endDate = endDateValue ? new Date(endDateValue) : new Date(currentDate);
    if (!endDateValue) endDate.setMonth(endDate.getMonth() + 3);
    let sessionCount = 1;
    const maxIterations = 365;
    let iterations = 0;
    const iterDate = new Date(currentDate);
    while (iterDate <= endDate && iterations < maxIterations) {
        if (targetDayIndexes.includes(iterDate.getDay())) {
            const year = iterDate.getFullYear();
            const month = String(iterDate.getMonth() + 1).padStart(2, '0');
            const day = String(iterDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            if (isClosedForClass(dateStr, cls.id, closures)) {
                iterDate.setDate(iterDate.getDate() + 1);
                iterations++;
                continue;
            }
            const weekdayKey = WEEKDAY_KEYS[(iterDate.getDay() + 6) % 7];
            const daySchedule = normalizedSchedule[weekdayKey] || null;
            sessions.push({ session: sessionCount++, date: dateStr, startTime: daySchedule?.start || '', endTime: daySchedule?.end || '' });
        }
        iterDate.setDate(iterDate.getDate() + 1);
        iterations++;
    }
    const start = toYmdSafe(startDateValue);
    const end = toYmdSafe(endDateValue);

    return sessions.filter((session) => inDateRange(session?.date || session?.ymd || session?.sessionDate || session, start, end));
};

const toDateString = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return v.slice(0, 10);
    if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
    try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
};

export const getLastCheckedDate = (rawResult) => {
    if (!rawResult) return null;

    const direct = rawResult.lastCheckedDate ?? rawResult.checkedAt ?? rawResult.checkedDate ?? null;
    if (direct) return direct;

    const history = rawResult.checkHistory;
    if (Array.isArray(history) && history.length > 0) {
        const last = history[history.length - 1]?.checkedDate ?? null;
        return last || null;
    }

    return null;
};

const resolveStudentKeys = (studentId, options = {}) => {
    const { activeViewerAuthUid, studentAuthUid, userId, activeStudentId, students } = options;
    const studentFromList = students?.find?.((s) => s?.id === studentId) || null;
    const keys = [
        activeViewerAuthUid,
        studentAuthUid,
        studentFromList?.authUid,
        userId,
        activeStudentId,
        studentId,
    ];
    return Array.from(new Set(keys.filter(Boolean).map(String)));
};

const findHomeworkResult = (results, studentKeys, assignmentId) => {
    if (studentKeys.length > 0 && results && typeof results === 'object' && !Array.isArray(results)) {
        for (const key of studentKeys) {
            const byStudent = results?.[key];
            if (byStudent && typeof byStudent === 'object') {
                const match = byStudent[assignmentId];
                if (match) return match;
            }
        }
    }

    if (Array.isArray(results)) {
        return results.find((r) => {
            const studentKey = r?.authUid || r?.studentId || r?.studentUid || r?.uid;
            if (!studentKey || !studentKeys.includes(String(studentKey))) return false;
            return String(r?.assignmentId) === String(assignmentId);
        }) || null;
    }
    
    return null;
};

export const calculateHomeworkStats = (studentId, assignments, results, options = {}) => {
    if (!assignments) return [];
    const studentKeys = resolveStudentKeys(studentId, options);

    return assignments
        .filter(hw => isAssignmentAssignedToStudent(hw, studentId, studentKeys))
        .map(hw => {
        const rawResult = findHomeworkResult(results, studentKeys, hw.id);
            const questionNumbers = getAssignmentQuestionNumbers(hw);
            const studentResults = normalizeHomeworkResultMapForDisplay(rawResult, questionNumbers, {
                assignmentId: hw.id,
                studentId,
            });
            const progress = computeHomeworkProgress(studentResults, questionNumbers);
            const questionStats = buildHomeworkQuestionStats({ assignment: hw, result: rawResult });
            const assignmentType = hw.type || 'homework';

            const statusLabel = assignmentType === 'video_makeup'
                ? '출제됨'
                : progress.status;

            const resolvedCheckedDate = getLastCheckedDate(rawResult) ?? rawResult?.updatedAt ?? null;

            return {
                ...hw,
                assignedDate: toDateString(hw.assignedDate) || toDateString(hw.date) || toDateString(hw.createdAt),
                lastCheckedDate: toDateString(resolvedCheckedDate),
                completionRate: progress.completionRate,
                status: statusLabel,
                checkedCount: progress.checkedCount,
                completedCount: questionStats.completedCount,
                correctCount: questionStats.correctCount,
                incorrectCount: questionStats.wrongCount,
                uncheckedCount: questionStats.remainingCount,
                fixedCount: questionStats.fixedCount,
                isComplete: isHomeworkCompleteByCounts({ wrongCount: questionStats.wrongCount, remainingCount: questionStats.remainingCount }),
                correctQuestionNumbers: questionStats.correctQuestionNumbers,
                wrongQuestionNumbers: questionStats.wrongQuestionNumbers,
                fixedQuestionNumbers: questionStats.fixedQuestionNumbers,
                remainingQuestionNumbers: questionStats.remainingQuestionNumbers,
            };
        });
};

export const calculateDurationMinutes = (start, end) => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
};

export const formatDuration = (minutes) => {
    if (minutes <= 0) return '0분';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};

export const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const normalizeClinicStatusValue = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
};

export const getClinicDisplayStatus = (item) => {
    if (!item) return '예약됨';

    const noShowKeywords = ['noshow', 'no_show', 'no-show', 'noshowed', 'missed', 'absent', '미참석'];
    const reservedKeywords = ['reserved', 'booked', 'pending', 'scheduled', '예약', '예약됨', '입실 예정'];

    const statusValue = normalizeClinicStatusValue(item.status);
    const attendanceValue = normalizeClinicStatusValue(item.attendanceStatus);
    const resultValue = normalizeClinicStatusValue(item.result);
    const checkStatusValue = normalizeClinicStatusValue(item.checkStatus);

    if (noShowKeywords.includes(statusValue)) return '미참석';
    if (noShowKeywords.includes(attendanceValue)) return '미참석';
    if (Boolean(item.noShow)) return '미참석';

    if (item.checkOut) return '완료';
    if (item.checkIn) return '입실 중';

    const hasPlannedTime = Boolean(item?.plannedTime || item?.timeSlot || item?.date);
    const isReserved = [statusValue, attendanceValue, resultValue, checkStatusValue].some((value) => reservedKeywords.includes(value));
    if (hasPlannedTime && isReserved) return '예약됨';
    if (hasPlannedTime) return '입실 예정';

    return '예약됨';
};

export const getClinicComment = (item) => {
    if (!item) return '';
    const candidates = [
        item.comment,
        item.note,
        item.notes,
        item.memo,
        item.content,
        item.reason,
        item.noShowComment,
        item.absenceComment,
    ];
    const resolved = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return resolved ? resolved.trim() : '';
};
