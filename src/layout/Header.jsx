import React from 'react';

export default function Header({ page }) {
    const pageTitleMap = {
        home: '시스템 대시보드',
        lessons: '수업 일지 및 진도 관리',
        attendance: '학생 출결 기록',
        students: '학생/학부모 정보 관리',
        grades: '시험 및 성적 관리',
        homework: '과제 배정 및 결과 관리',
        clinic: '클리닉 활동 로그',
        communication: '내부 소통 및 공지',
        payment: '교재 및 수납 현황',
    };
    
    return (
        <header className="bg-white shadow-sm flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold text-gray-800">{pageTitleMap[page] || '관리 시스템'}</h1>
            <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-600">채수용 선생님</span>
            </div>
        </header>
    );
};