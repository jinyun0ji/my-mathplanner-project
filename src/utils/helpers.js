// src/utils/helpers.js
import React from 'react';
import { isAssignmentAssignedToStudent } from '../domain/homework/homework.service';
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
    RefreshCw, UserX
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
        refreshCw: RefreshCw, userX: UserX
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
export const calculateGradeComparison = (studentId, classes, tests, grades) => {
    if (!tests || !grades) return []; 

    const myGrades = [];
    const myClassIds = classes.filter(c => (c.students || []).includes(studentId)).map(c => c.id);
    const relevantTests = tests.filter(t => myClassIds.includes(t.classId));

    const computeScoreFromCorrectCount = (record, test) => {
        if (!record?.correctCount) return null;

        const entries = Object.entries(record.correctCount);
        if (entries.length === 0) return 0;

        // 맞음/고침을 정답으로 처리
        const correct = entries.filter(([, v]) => v === '맞음' || v === '고침').length;
        const total = entries.length;

        const maxScore = Number(test?.maxScore) || 0;
        if (maxScore <= 0) return correct; // 만점이 없으면 '맞은 개수'라도 반환

        return Math.round((correct / total) * maxScore);
    };


    relevantTests.forEach(test => {
        const myRecord = grades[studentId]?.[test.id];
        
        if (myRecord) {
            let classTotal = 0;
            let studentCount = 0;
            let highestScore = 0; // 최고점
            const classInfo = classes.find(c => String(c.id) === String(test.classId));
            const classStudentIds = classInfo?.students || [];
            const participantScores = [];

            const questionStats = {};

            // 반 통계 계산 (평균, 최고점 등)
            Object.entries(grades).forEach(([stuId, studentGrade]) => {
                if (!classStudentIds.includes(stuId)) return;
                const record = studentGrade[test.id];
                if (record) {
                    const rawScore = record.score;
                    const computedScore = computeScoreFromCorrectCount(record, test);
                    const finalScore =
                    (rawScore === null || rawScore === undefined)
                        ? (computedScore ?? null)
                        : (rawScore === 0 && record.correctCount ? (computedScore ?? 0) : rawScore);

                    if (finalScore !== null && finalScore !== undefined) {
                        classTotal += finalScore;
                        studentCount++;
                        participantScores.push(finalScore);
                        if (finalScore > highestScore) highestScore = finalScore;
                    }

                    if (record.correctCount) {
                        Object.entries(record.correctCount).forEach(([qNum, status]) => {
                            if (!questionStats[qNum]) questionStats[qNum] = { correct: 0, total: 0 };
                            questionStats[qNum].total++;
                            if (status === '맞음' || status === '고침') {
                                questionStats[qNum].correct++;
                            }
                        });
                    }
                }
            });

            const classAverage = studentCount > 0 ? Math.round(classTotal / studentCount) : 0;
            const rawMyScore = myRecord.score;
            const computedMyScore = computeScoreFromCorrectCount(myRecord, test);

            // score가 null/undefined 이거나, 0인데 문항 데이터가 있으면 "계산값"을 우선
            const myScore =
            (rawMyScore === null || rawMyScore === undefined)
                ? (computedMyScore ?? 0)
                : (rawMyScore === 0 && myRecord.correctCount ? (computedMyScore ?? 0) : rawMyScore);

            const myAccuracy = test.maxScore > 0 ? Math.round((myScore / test.maxScore) * 100) : 0;
            const rank = participantScores.length > 0 ? participantScores.filter(score => score > myScore).length + 1 : null;
            
            // ✅ [핵심 수정] Z-Score 계산 (공식: (내점수 - 시험평균) / 표준편차)
            // 주의: test.average(시험 전체 평균)와 test.stdDev(표준편차) 사용
            let zScore = 0;
            
            // test 데이터에 average와 stdDev가 있는 경우 우선 사용
            const testAvg = test.average !== undefined ? test.average : classAverage;
            
            if (test.stdDev > 0) {
                zScore = (myScore - testAvg) / test.stdDev;
            } else {
                // 표준편차가 0이거나 데이터가 없으면 Z-score 계산 불가 (0 처리)
                zScore = 0; 
            }

            // 소수점 2자리까지만 유지 (선택사항, 계산 정확도를 위해 값은 유지하되 표시는 나중에)
            // zScore = parseFloat(zScore.toFixed(2));

            const questionsAnalysis = [];
            if (test.questionScores && myRecord.correctCount) {
                test.questionScores.forEach((score, idx) => {
                    const qNum = idx + 1;
                    const status = myRecord.correctCount[qNum] || '미응시';
                    const stats = questionStats[qNum] || { correct: 0, total: 0 };
                    const itemAccuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

                    questionsAnalysis.push({
                        no: qNum, score: score, status: status, itemAccuracy: itemAccuracy, 
                        type: '객관식', difficulty: test.questionAnalysis?.[idx]?.difficulty || '중' 
                    });
                });
            }

            myGrades.push({
                testId: test.id, testName: test.name, testDate: test.date,
                className: classes.find(c => String(c.id) === String(test.classId))?.name || '반 정보 없음',
                studentScore: myScore, 
                classAverage: classAverage, 
                highestScore: highestScore,
                maxScore: test.maxScore,
                accuracy: myAccuracy,
                rank: rank,
                totalStudents: participantScores.length,
                scoreDifference: myScore - classAverage,
                isAboveAverage: myScore >= classAverage,
                questions: questionsAnalysis,
                zScore: zScore // 계산된 Z-Score 포함
            });
        }
    });

    // 날짜 내림차순 정렬 (최신순)
    return myGrades.sort((a, b) => new Date(b.testDate) - new Date(a.testDate));
};

export const calculateClassSessions = (cls) => {
    if (!cls || !cls.schedule || !cls.schedule.days) return [];
    const sessions = [];
    const daysMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
    const targetDayIndexes = cls.schedule.days.map(d => daysMap[d]);
    const currentDate = cls.startDate ? new Date(cls.startDate) : new Date();
    const endDate = cls.endDate ? new Date(cls.endDate) : new Date(currentDate);
    if (!cls.endDate) endDate.setMonth(endDate.getMonth() + 3);
    let sessionCount = 1;
    const maxIterations = 365;
    let iterations = 0;
    const iterDate = new Date(currentDate);
    while (iterDate <= endDate && iterations < maxIterations) {
        if (targetDayIndexes.includes(iterDate.getDay())) {
            const year = iterDate.getFullYear();
            const month = String(iterDate.getMonth() + 1).padStart(2, '0');
            const day = String(iterDate.getDate()).padStart(2, '0');
            sessions.push({ session: sessionCount++, date: `${year}-${month}-${day}` });
        }
        iterDate.setDate(iterDate.getDate() + 1);
        iterations++;
    }
    return sessions;
};

export const calculateHomeworkStats = (studentId, assignments, results) => {
    if (!assignments) return [];
    return assignments
        .filter(hw => isAssignmentAssignedToStudent(hw, studentId))
        .map(hw => {
        const studentResults = results?.[studentId]?.[hw.id] || {};
        const totalQuestions = hw.totalQuestions;
        let correctCount = 0;
        let incorrectCount = 0;
        Object.values(studentResults).forEach(status => {
            if (status === '맞음' || status === '고침') correctCount++;
            else if (status === '틀림') incorrectCount++;
        });
        const completedCount = correctCount + incorrectCount;
        const uncheckedCount = totalQuestions - completedCount;
        const completionRate = Math.round((completedCount / totalQuestions) * 100);
        let status = '미시작';
        if (completionRate > 0 && completionRate < 100) status = '진행 중';
        else if (completionRate === 100) status = (incorrectCount > 0) ? '오답 정리' : '완료';
        const incorrectQuestionList = Object.keys(studentResults).filter(qNum => studentResults[qNum] === '틀림').map(Number).sort((a, b) => a - b);
        return { ...hw, completionRate, status, completedCount: correctCount, incorrectCount, uncheckedCount, incorrectQuestionList };
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