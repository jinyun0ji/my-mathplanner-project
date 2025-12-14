// src/utils/helpers.js
import React from 'react';
import { 
    Home, Calendar, Clipboard, BarChart2, Menu, 
    User, Users, ChevronRight, ChevronLeft, CheckCircle, Clock, 
    AlertCircle, X, ChevronDown, Check, LogOut,
    Bell, MessageSquare, Video, FileText, Lock,
    Search, Filter, MoreVertical, Plus, Trash2,
    PlayCircle, PauseCircle, StopCircle, Volume2, VolumeX,
    Maximize, Minimize, Settings, BookOpen, PenTool,
    MapPin, Phone, Mail, Award, TrendingUp, Activity
} from 'lucide-react';

// Icon 컴포넌트
export const Icon = ({ name, className, ...props }) => {
    const icons = {
        home: Home, calendar: Calendar, clipboard: Clipboard, clipboardCheck: Clipboard, 
        barChart: BarChart2, menu: Menu, user: User, users: Users, 
        chevronRight: ChevronRight, chevronLeft: ChevronLeft, 
        checkCircle: CheckCircle, clock: Clock, 
        alertCircle: AlertCircle, x: X, chevronDown: ChevronDown, check: Check,
        logOut: LogOut, bell: Bell, messageSquare: MessageSquare, monitor: Video,
        fileText: FileText, lock: Lock, search: Search, filter: Filter,
        moreVertical: MoreVertical, plus: Plus, trash: Trash2,
        play: PlayCircle, pause: PauseCircle, stop: StopCircle,
        volume: Volume2, mute: VolumeX, fullscreen: Maximize, exitFullscreen: Minimize,
        settings: Settings, book: BookOpen, pen: PenTool,
        mapPin: MapPin, phone: Phone, mail: Mail, award: Award,
        trend: TrendingUp, list: Activity, school: Home, pin: MapPin
    };
    
    // 매핑되지 않은 이름이 들어오면 Home 아이콘이 뜨도록 fallback 처리
    const LucideIcon = icons[name] || Home;
    return <LucideIcon className={className} {...props} />;
};

export const staffMembers = [
    { id: 'teacher', name: '채수용 선생님', role: 'teacher', avatar: 'C' },
    { id: 'lab', name: '수학 연구소', role: 'admin', avatar: 'Lab' }
];

export const getWeekOfMonthISO = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { month: d.getMonth() + 1, week: weekNo };
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
    return assignments.map(hw => {
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

        const incorrectQuestionList = Object.keys(studentResults)
            .filter(qNum => studentResults[qNum] === '틀림')
            .map(Number).sort((a, b) => a - b);

        return {
            ...hw, completionRate, status, completedCount: correctCount,
            incorrectCount, uncheckedCount, incorrectQuestionList
        };
    });
};

export const calculateGradeComparison = (studentId, classes, tests, grades) => {
    if (!tests || !grades) return []; 

    const myGrades = [];
    const myClassIds = classes.filter(c => c.students.includes(studentId)).map(c => c.id);
    const relevantTests = tests.filter(t => myClassIds.includes(t.classId));

    relevantTests.forEach(test => {
        const myRecord = grades[studentId]?.[test.id];
        
        if (myRecord) {
            let classTotal = 0;
            let studentCount = 0;
            const questionStats = {}; 

            Object.values(grades).forEach(studentGrade => {
                const record = studentGrade[test.id];
                if (record) {
                    if (record.score !== null) {
                        classTotal += record.score;
                        studentCount++;
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
            const myScore = myRecord.score || 0;
            const myAccuracy = test.maxScore > 0 ? Math.round((myScore / test.maxScore) * 100) : 0;

            const questionsAnalysis = [];
            if (test.questionScores && myRecord.correctCount) {
                test.questionScores.forEach((score, idx) => {
                    const qNum = idx + 1;
                    const status = myRecord.correctCount[qNum] || '미응시';
                    const stats = questionStats[qNum] || { correct: 0, total: 0 };
                    const itemAccuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

                    questionsAnalysis.push({
                        no: qNum,
                        score: score,
                        status: status,
                        itemAccuracy: itemAccuracy, 
                        type: '객관식' 
                    });
                });
            }

            myGrades.push({
                testId: test.id,
                testName: test.name,
                testDate: test.date,
                className: classes.find(c => c.id === test.classId)?.name || '반 정보 없음',
                studentScore: myScore,
                classAverage: classAverage,
                maxScore: test.maxScore,
                accuracy: myAccuracy, 
                scoreDifference: myScore - classAverage,
                isAboveAverage: myScore >= classAverage,
                questions: questionsAnalysis
            });
        }
    });

    return myGrades;
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