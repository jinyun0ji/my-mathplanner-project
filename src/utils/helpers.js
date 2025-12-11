// src/utils/helpers.js
import React from 'react';

// 교직원 Mock 데이터 추가 (채팅 가능 대상)
export const staffMembers = [
    { id: 'staff-1', name: '김원장', role: '원장' },
    { id: 'staff-2', name: '이실장', role: '행정 실장' },
    { id: 'staff-3', name: '박선생', role: '강사' },
    { id: 'staff-4', name: '최선생', role: '강사' },
    { id: 'staff-5', name: '정조교', role: '조교' },
];

// --- 아이콘 컴포넌트 ---
export const Icon = ({ name, className }) => {
    // ... (Icon 내용 유지)
    const icons = {
        dashboard: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
        users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
        school: <><path d="M14 22v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4"/><path d="M18 10a2 2 0 0 0-2-2h-1"/><path d="M12 2h6v6"/><path d="M2 10V5a2 2 0 0 1 2-2h4v6z"/><path d="M6 18v-4"/><path d="M10 18v-4"/></>,
        logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></>,
        plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
        search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
        edit: <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>,
        trash: <><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
        x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
        fileText: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y1="9"/></>,
        messageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
        graduationCap: <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.33 1.67 6.67 1.67 10 0v-5"/></>,
        wallet: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5h-2.43a2 2 0 0 1-1.94-1.51L15 9H5a2 2 0 0 0-2 2Z"/></>,
        barChart: <><path d="M12 20V10M18 20V4M6 20v-6"/></>,
        clipboardCheck: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M10 12L12 14L18 8"/></>,
        bookOpen: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
        calendar: <><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></>, 
        chevronDown: <path d="m6 9 6 6 6-6"/>,
        chevronUp: <path d="m18 15-6-6-6 6"/>,
        upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></>,
        send: <path d="m22 2-7 20-4-9-9-4 20-7Z"/>,
        pin: <path d="M12 17v-4h4l-4-9V2h-4v2l4 9h-4v4h-2v2h12v-2z"/>,
        clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
        bell: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.424-3.535A12 12 0 0012 3c-4.707 0-9.155 1.34-12 3.861M12 3c-4.707 0-9.155 1.34-12 3.861m12 10.221v3.375c0 .375-.375.75-.75.75H12c-.375 0-.75-.375-.75-.75v-3.375m-4.5 0h9m-9 0h9" /></svg>,
        monitor: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 14.25v-2.75a3 3 0 00-3-3h-2.25M15.75 14.25l-2.75 2.75m2.75-2.75l-2.75-2.75m1.5-12.25H7.5A2.25 2.25 0 005.25 4.5v15a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25V9M12 11.25h.008v.008H12V11.25zM12 14.25h.008v.008H12V14.25zM12 17.25h.008v.008H12V17.25z" /></svg>,
        save: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>,
        check: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-10.5" /></svg>,
        info: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.375c.83 6.148 6.536 7.21 10.976 7.21s10.146-1.062 10.976-7.21-1.062-10.146-7.21-10.976S4.707 5.757 3.877 11.895z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15h.008v.008H12V15z" /></svg>,
        alert: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.375c-.83 6.148 4.707 9.143 10.146 9.143s10.976-2.995 10.146-9.143L12 3.375 2.877 11.895z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15h.008v.008H12V15z" /></svg>,
        "arrow-left": <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>,
    };
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
};

/**
 * 클래스 스케줄과 개강일을 기반으로 수업 회차 목록을 계산합니다.
 */
export const calculateClassSessions = (cls) => {
    // ... (로직 유지)
    if (!cls || !cls.startDate || !cls.schedule || cls.schedule.days.length === 0) return [];

    const parts = cls.startDate.split('-');
    const start = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    
    const today = new Date();
    // UTC로 today 설정
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())); 
    
    const sessions = [];
    let sessionCount = 1;

    const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
    const scheduledDays = cls.schedule.days.map(day => dayMap[day]).filter(d => d !== undefined);
    
    let currentDate = new Date(start);

    while (currentDate <= end) {
        if (scheduledDays.includes(currentDate.getUTCDay())) {
            sessions.push({
                session: sessionCount++,
                date: currentDate.toISOString().slice(0, 10)
            });
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return sessions;
};

// --- StudentDetail Helper Functions ---
export const calculateGradeComparison = (studentId, classes, tests, grades) => {
    // ... (로직 유지)
    const comparison = [];

    classes.forEach(cls => {
        if (!cls.students.includes(studentId)) return; 

        const classTests = tests.filter(t => t.classId === cls.id);
        if (classTests.length === 0) return;

        classTests.forEach(test => {
            const scoreData = grades[studentId]?.[test.id];
            const studentScore = scoreData?.score;
            
            // 미응시(null) 또는 점수가 없는 경우 제외
            if (studentScore === undefined || studentScore === null) return; 

            // 클래스 평균 계산
            let totalClassScore = 0;
            let classStudentCount = 0;
            cls.students.forEach(sId => {
                const score = grades[sId]?.[test.id]?.score;
                 // 미응시(null) 제외
                if (score !== undefined && score !== null) { 
                    totalClassScore += Number(score);
                    classStudentCount++;
                }
            });
            const classAverage = classStudentCount > 0 ? (totalClassScore / classStudentCount).toFixed(1) : 0;
            
            comparison.push({
                className: cls.name,
                testName: test.name,
                maxScore: test.maxScore,
                studentScore: Number(studentScore),
                classAverage: Number(classAverage),
                isAboveAverage: Number(studentScore) > Number(classAverage),
                scoreDifference: (Number(studentScore) - Number(classAverage)).toFixed(1)
            });
        });
    });

    return comparison;
};


export const calculateHomeworkStats = (studentId, homeworkAssignments, homeworkResults) => {
    // ... (로직 유지)
    const studentAssignments = homeworkAssignments.filter(a => a.students.includes(studentId));
    
    return studentAssignments.map(a => {
        const results = homeworkResults[studentId]?.[a.id] || {};
        const totalQuestions = a.totalQuestions;
        
        let completedCount = 0; 
        let incorrectCount = 0; 
        let uncheckedCount = totalQuestions;
        
        if (Object.keys(results).length > 0) {
            uncheckedCount = 0; 
            Object.values(results).forEach(status => {
                if (status === '맞음' || status === '고침') {
                    completedCount++;
                }
                if (status === '틀림') {
                    incorrectCount++;
                }
            });
            uncheckedCount = totalQuestions - completedCount - incorrectCount;
            if (uncheckedCount < 0) uncheckedCount = 0;
        }


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
            completionRate,
            status: completionRate === 100 ? '완료' : (completionRate > 0 ? '진행 중' : '미시작')
        };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
};