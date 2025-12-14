// src/utils/helpers.js
import React from 'react';
import { 
    Home, Calendar, Clipboard, BarChart2, Menu, 
    User, Users, ChevronRight, CheckCircle, Clock, 
    AlertCircle, X, ChevronDown, Check, LogOut,
    Bell, MessageSquare, Video, FileText, Lock,
    Search, Filter, MoreVertical, Plus, Trash2,
    PlayCircle, PauseCircle, StopCircle, Volume2, VolumeX,
    Maximize, Minimize, Settings, BookOpen, PenTool,
    MapPin, Phone, Mail, Award, TrendingUp, Activity
} from 'lucide-react';

// Icon 컴포넌트 (기존 유지)
export const Icon = ({ name, className, ...props }) => {
    const icons = {
        home: Home, calendar: Calendar, clipboard: Clipboard, clipboardCheck: Clipboard, 
        barChart: BarChart2, menu: Menu, user: User, users: Users, 
        chevronRight: ChevronRight, checkCircle: CheckCircle, clock: Clock, 
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
    const LucideIcon = icons[name] || Home;
    return <LucideIcon className={className} {...props} />;
};

// ✅ [추가] staffMembers 데이터 export (임시 데이터)
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

// ✅ [수정] 클래스 정보를 받아 수업 회차와 날짜 목록(배열)을 반환하는 함수로 변경
export const calculateClassSessions = (cls) => {
    // 데이터 유효성 검사: 클래스나 스케줄 정보가 없으면 빈 배열 반환
    if (!cls || !cls.schedule || !cls.schedule.days) return [];

    const sessions = [];
    const daysMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
    
    // 요일 문자열을 숫자(0~6)로 변환
    const targetDayIndexes = cls.schedule.days.map(d => daysMap[d]);

    // 시작일 설정 (없으면 오늘 날짜)
    const currentDate = cls.startDate ? new Date(cls.startDate) : new Date();
    
    // 종료일 설정 (없으면 시작일로부터 3개월 뒤)
    const endDate = cls.endDate ? new Date(cls.endDate) : new Date(currentDate);
    if (!cls.endDate) {
        endDate.setMonth(endDate.getMonth() + 3);
    }

    // 날짜 순회하며 회차 생성
    let sessionCount = 1;
    // 무한 루프 방지를 위해 최대 1년(365일)까지만 계산
    const maxIterations = 365;
    let iterations = 0;

    // 복사본 생성하여 날짜 계산 (원본 Date 객체 오염 방지)
    const iterDate = new Date(currentDate);

    while (iterDate <= endDate && iterations < maxIterations) {
        // 현재 날짜의 요일이 수업 요일에 포함되는지 확인
        if (targetDayIndexes.includes(iterDate.getDay())) {
            // YYYY-MM-DD 형식으로 변환
            const year = iterDate.getFullYear();
            const month = String(iterDate.getMonth() + 1).padStart(2, '0');
            const day = String(iterDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            sessions.push({
                session: sessionCount++,
                date: dateStr
            });
        }
        // 하루 증가
        iterDate.setDate(iterDate.getDate() + 1);
        iterations++;
    }

    return sessions;
};

// ✅ [수정] 과제 통계 계산 (오답까지 완료해야 '완료' 처리)
export const calculateHomeworkStats = (studentId, assignments, results) => {
    if (!assignments) return [];
    
    return assignments.map(hw => {
        const studentResults = results?.[studentId]?.[hw.id] || {};
        const totalQuestions = hw.totalQuestions;
        const completedQuestions = Object.keys(studentResults).length;
        
        // 정답, 오답 개수 계산
        let correctCount = 0;
        let incorrectCount = 0;
        
        Object.values(studentResults).forEach(status => {
            if (status === '맞음' || status === '고침') correctCount++;
            else if (status === '틀림') incorrectCount++;
        });

        const completedCount = correctCount + incorrectCount; // (푼 문제 수)
        const uncheckedCount = totalQuestions - completedCount;

        // 진행률: (정답+오답) / 전체
        const completionRate = Math.round((completedCount / totalQuestions) * 100);

        // ✅ 상태 결정 로직 변경
        let status = '미시작';
        if (completionRate > 0 && completionRate < 100) {
            status = '진행 중';
        } else if (completionRate === 100) {
            // 다 풀었어도 오답이 남아있으면 완료 아님
            if (incorrectCount > 0) {
                status = '오답 정리'; // 오답이 남음
            } else {
                status = '완료'; // 오답까지 모두 해결됨
            }
        }

        // 오답 리스트 생성
        const incorrectQuestionList = Object.keys(studentResults)
            .filter(qNum => studentResults[qNum] === '틀림')
            .map(Number)
            .sort((a, b) => a - b);

        return {
            ...hw,
            completionRate,
            status,
            completedCount: correctCount, // '맞음' 개수만 전달 (UI 표시용)
            incorrectCount,
            uncheckedCount,
            incorrectQuestionList
        };
    });
};

// ✅ [수정] 성적 비교 데이터 (정답률 추가)
export const calculateGradeComparison = (studentId, classes, tests, grades) => {
    if (!tests || !grades || !grades[studentId]) return [];

    const myGrades = [];
    const myClassIds = classes.filter(c => c.students.includes(studentId)).map(c => c.id);

    // 내가 속한 반의 시험만 필터링
    const relevantTests = tests.filter(t => myClassIds.includes(t.classId));

    relevantTests.forEach(test => {
        const myRecord = grades[studentId][test.id];
        
        // 미응시 제외 (또는 미응시 표시)
        if (myRecord) {
            // 반 평균 계산
            let classTotal = 0;
            let count = 0;
            Object.values(grades).forEach(studentGrade => {
                if (studentGrade[test.id] && studentGrade[test.id].score !== null) {
                    classTotal += studentGrade[test.id].score;
                    count++;
                }
            });
            const classAverage = count > 0 ? Math.round(classTotal / count) : 0;
            
            // 내 점수
            const myScore = myRecord.score || 0;
            
            // ✅ 정답률 계산
            const accuracy = test.maxScore > 0 
                ? Math.round((myScore / test.maxScore) * 100) 
                : 0;

            // 문항별 분석 데이터 가공
            const questionsAnalysis = [];
            if (test.questionScores && myRecord.correctCount) {
                test.questionScores.forEach((score, idx) => {
                    const qNum = idx + 1;
                    const status = myRecord.correctCount[qNum] || '미응시';
                    questionsAnalysis.push({
                        no: qNum,
                        score: score,
                        status: status, // 맞음, 틀림, 고침
                        difficulty: '중', // 임시 난이도
                        type: '객관식' // 임시 유형
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
                accuracy: accuracy, // ✅ 정답률 추가
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