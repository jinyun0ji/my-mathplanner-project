// src/utils/helpers.js
import React from 'react';

// --- 아이콘 컴포넌트 ---
export const Icon = ({ name, className }) => {
    const icons = {
        // 단일 경로 아이콘들
        dashboard: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
        messageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
        edit: <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>,
        chevronDown: <path d="m6 9 6 6 6-6"/>,
        chevronUp: <path d="m18 15-6-6-6 6"/>,
        send: <path d="m22 2-7 20-4-9-9-4 20-7Z"/>,
        pin: <path d="M12 17v-4h4l-4-9V2h-4v2l4 9h-4v4h-2v2h12v-2z"/>,
        home: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>, 
        chevronRight: <polyline points="9 18 15 12 9 6"></polyline>,
        lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
        trend: <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>,
        list: <><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></>,

        // 복합 경로 아이콘들 (Fragment 필수)
        users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
        school: <><path d="M14 22v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4"/><path d="M18 10a2 2 0 0 0-2-2h-1"/><path d="M12 2h6v6"/><path d="M2 10V5a2 2 0 0 1 2-2h4v6z"/><path d="M6 18v-4"/><path d="M10 18v-4"/></>,
        logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></>,
        plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
        search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
        trash: <><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
        x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
        graduationCap: <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.33 1.67 6.67 1.67 10 0v-5"/></>,
        wallet: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5h-2.43a2 2 0 0 1-1.94-1.51L15 9H5a2 2 0 0 0-2 2Z"/></>,
        barChart: <><path d="M12 20V10M18 20V4M6 20v-6"/></>,
        clipboardCheck: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M10 12L12 14L18 8"/></>,
        bookOpen: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
        upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></>,
        clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
        calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></>,
        menu: <><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></>,
        user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></>,
        fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></>,
        alignLeft: <><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></>,
        alignCenter: <><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="10" x2="7" y2="10"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="7" y2="18"/></>,
        alignRight: <><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></>,
        image: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
        
        // SVG 태그
        bell: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.424-3.535A12 12 0 0012 3c-4.707 0-9.155 1.34-12 3.861M12 3c-4.707 0-9.155 1.34-12 3.861m12 10.221v3.375c0 .375-.375.75-.75.75H12c-.375 0-.75-.375-.75-.75v-3.375m-4.5 0h9m-9 0h9" /></svg>,
        monitor: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 14.25v-2.75a3 3 0 00-3-3h-2.25M15.75 14.25l-2.75 2.75m2.75-2.75l-2.75-2.75m1.5-12.25H7.5A2.25 2.25 0 005.25 4.5v15a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25V9M12 11.25h.008v.008H12V11.25zM12 14.25h.008v.008H12V14.25zM12 17.25h.008v.008H12V17.25z" /></svg>,
        save: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>,
        check: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-10.5" /></svg>,
        info: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.375c.83 6.148 6.536 7.21 10.976 7.21s10.146-1.062 10.976-7.21-1.062-10.146-7.21-10.976S4.707 5.757 3.877 11.895z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15h.008v.008H12V15z" /></svg>,
        alert: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.375c-.83 6.148 4.707 9.143 10.146 9.143s10.976-2.995 10.146-9.143L12 3.375 2.877 11.895z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15h.008v.008H12V15z" /></svg>,
        alertCircle: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
        "arrow-left": <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>,
    };
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
};

// --- 날짜 관련 함수 ---
export const getWeekOfMonthISO = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const targetThursday = new Date(d);
    targetThursday.setDate(d.getDate() + (4 - d.getDay()));
    const month = targetThursday.getMonth() + 1; 
    const year = targetThursday.getFullYear();
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const firstThursday = new Date(firstDayOfMonth);
    if (firstThursday.getDay() <= 4) {
        firstThursday.setDate(1 + (4 - firstThursday.getDay()));
    } else {
        firstThursday.setDate(1 + (4 - firstThursday.getDay()) + 7);
    }
    const diffTime = targetThursday.getTime() - firstThursday.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return { year, month, week: 1 + diffWeeks };
};

export const calculateClassSessions = (cls) => {
    if (!cls || !cls.startDate || !cls.schedule || cls.schedule.days.length === 0) return [];
    const parts = cls.startDate.split('-');
    const start = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    const today = new Date();
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())); 
    const sessions = [];
    let sessionCount = 1;
    const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
    const scheduledDays = cls.schedule.days.map(day => dayMap[day]).filter(d => d !== undefined);
    let currentDate = new Date(start);
    while (currentDate <= end) {
        if (scheduledDays.includes(currentDate.getUTCDay())) {
            sessions.push({ session: sessionCount++, date: currentDate.toISOString().slice(0, 10) });
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return sessions;
};

// ✅ [수정] 성적 상세 데이터(questions) 추가
export const calculateGradeComparison = (studentId, classes, tests, grades) => {
    const comparison = [];
    classes.forEach(cls => {
        if (!cls.students.includes(studentId)) return; 
        const classTests = tests.filter(t => t.classId === cls.id);
        if (classTests.length === 0) return;
        classTests.forEach(test => {
            const scoreData = grades[studentId]?.[test.id];
            const studentScore = scoreData?.score;
            if (studentScore === undefined || studentScore === null) return; 
            
            // 클래스 평균
            let totalClassScore = 0;
            let classStudentCount = 0;
            cls.students.forEach(sId => {
                const score = grades[sId]?.[test.id]?.score;
                if (score !== undefined && score !== null) { 
                    totalClassScore += Number(score);
                    classStudentCount++;
                }
            });
            const classAverage = classStudentCount > 0 ? (totalClassScore / classStudentCount).toFixed(1) : 0;
            
            // ✅ [New] 문항별 분석 데이터 생성
            const questionDetails = test.questionScores.map((score, idx) => {
                const qNum = idx + 1;
                // grades 데이터에 correctCount가 {"1": "맞음", ...} 형태로 저장되어 있다고 가정
                const status = scoreData?.correctCount?.[qNum] || '미응시'; 
                const analysis = test.questionAnalysis?.[idx] || { difficulty: '-', type: '-' };
                
                return {
                    no: qNum,
                    score,
                    status, // '맞음', '틀림', '고침' 등
                    difficulty: analysis.difficulty,
                    type: analysis.type
                };
            });

            comparison.push({
                testId: test.id, // ID 추가 (Key용)
                className: cls.name,
                testName: test.name,
                testDate: test.date,
                maxScore: test.maxScore,
                studentScore: Number(studentScore),
                classAverage: Number(classAverage),
                isAboveAverage: Number(studentScore) > Number(classAverage),
                scoreDifference: (Number(studentScore) - Number(classAverage)).toFixed(1),
                questions: questionDetails // ✅ 추가됨
            });
        });
    });
    return comparison.sort((a, b) => new Date(b.testDate) - new Date(a.testDate));
};

export const calculateHomeworkStats = (studentId, homeworkAssignments, homeworkResults) => {
    const studentAssignments = homeworkAssignments.filter(a => a.students.includes(studentId));
    
    return studentAssignments.map(a => {
        const results = homeworkResults[studentId]?.[a.id] || {};
        const totalQuestions = a.totalQuestions;
        
        let completedCount = 0; 
        let incorrectCount = 0; 
        let uncheckedCount = totalQuestions;
        let incorrectQuestionList = [];

        if (Object.keys(results).length > 0) {
            uncheckedCount = 0; 
            Object.keys(results).forEach(qNum => {
                const status = results[qNum];
                if (status === '맞음' || status === '고침') {
                    completedCount++;
                }
                if (status === '틀림') {
                    incorrectCount++;
                    incorrectQuestionList.push(qNum);
                }
            });
            uncheckedCount = totalQuestions - completedCount - incorrectCount;
            if (uncheckedCount < 0) uncheckedCount = 0;
        }

        incorrectQuestionList.sort((a, b) => Number(a) - Number(b));

        const completionRate = Math.round(((completedCount + incorrectCount) / totalQuestions) * 100);

        return {
            id: a.id,
            date: a.date,
            content: a.content,
            book: a.book,
            totalQuestions,
            completedCount,
            incorrectCount,
            uncheckedCount,
            incorrectQuestionList,
            completionRate,
            status: completionRate === 100 ? '완료' : (completionRate > 0 ? '진행 중' : '미시작')
        };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const staffMembers = [
    { id: 'staff-1', name: '김원장', role: '원장' },
    { id: 'staff-2', name: '이실장', role: '행정 실장' },
    { id: 'staff-3', name: '박선생', role: '강사' },
    { id: 'staff-4', name: '최선생', role: '강사' },
    { id: 'staff-5', name: '정조교', role: '조교' },
];

// ✅ [추가] 유튜브 비디오 ID 추출
export const getYouTubeId = (iframeCode) => {
    if (!iframeCode) return null;
    const srcMatch = iframeCode.match(/src="([^"]+)"/);
    if (!srcMatch) return null;
    const url = srcMatch[1];
    const idMatch = url.match(/\/embed\/([^/?]+)/);
    return idMatch ? idMatch[1] : null;
};

// ✅ [추가] 시간 포맷 (초 -> MM:SS)
export const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};