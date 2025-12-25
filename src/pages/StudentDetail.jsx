import React, { useEffect, useMemo, useState } from 'react';
import { Icon, formatGradeLabel } from '../utils/helpers';
import ModalPortal from '../components/common/ModalPortal';

// calculateGradeComparison, calculateHomeworkStats는 App.jsx에서 props로 전달받음
export default function StudentDetail({
    studentId, students, classes, studentMemos, grades, tests, homeworkAssignments, homeworkResults, handlePageChange,
    handleSaveMemo, calculateGradeComparison, calculateHomeworkStats
}) {
    const normalizedStudentId = useMemo(() => {
        if (studentId === null || studentId === undefined) return studentId;
        const asNumber = Number(studentId);
        return Number.isNaN(asNumber) ? studentId : asNumber;
    }, [studentId]);
    const student = useMemo(() => students.find(s => s.id === normalizedStudentId), [students, normalizedStudentId]);

    const [memoDraft, setMemoDraft] = useState('');
    const [activeMobileTab, setActiveMobileTab] = useState('attendance');
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

    const latestMemo = studentMemos[normalizedStudentId];

    useEffect(() => {
        setMemoDraft(latestMemo || '');
    }, [latestMemo, normalizedStudentId]);
    
    if (!student) {
        return (
            <div className="p-6 bg-white rounded-xl shadow-md">
                <p className="text-red-500">학생 정보를 찾을 수 없습니다. (ID: {studentId})</p>
                <button 
                    onClick={() => handlePageChange('students')} 
                    className="mt-4 text-blue-600 hover:underline flex items-center"
                >
                    <Icon name="arrow-left" className="w-4 h-4 mr-1"/> 학생 목록으로 돌아가기
                </button>
            </div>
        );
    }
    
    const studentClasses = student?.classes.map(id => classes.find(c => c.id === id)).filter(c => c) || [];
    
    // 유틸리티 함수를 이용한 데이터 계산 (App.jsx에서 props로 전달)
    const gradeComparison = calculateGradeComparison(normalizedStudentId, classes, tests, grades);
    const homeworkStats = calculateHomeworkStats(normalizedStudentId, homeworkAssignments, homeworkResults);
    
    // 최근 성적 4개만 표시
    const recentGrades = gradeComparison.slice(-4).reverse();
    
    // 최근 과제 4개만 표시
    const recentHomeworks = homeworkStats.slice(0, 4);

    const totalHomeworks = homeworkStats.length;
    const completedHomeworks = homeworkStats.filter(h => h.isCompleted).length;
    const homeworkCompletionRate = totalHomeworks ? Math.round((completedHomeworks / totalHomeworks) * 100) : 0;
    const pendingHomeworkCount = homeworkStats.filter(h => !h.isCompleted).length;

    const saveMemo = () => {
        if (!handleSaveMemo) return;
        handleSaveMemo(normalizedStudentId, memoDraft.trim());
    };

    const mobileTabs = [
        { id: 'attendance', label: '출결' },
        { id: 'classes', label: '수업' },
        { id: 'homework', label: '과제' },
        { id: 'grades', label: '성적' },
        { id: 'memo', label: '메모' }
    ];

    const renderMobileContent = () => {
        switch (activeMobileTab) {
            case 'attendance':
                return (
                    <div className="space-y-3">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold text-gray-900">출결 기록 빠르게 확인하기</p>
                            <p className="mt-1 text-xs text-gray-500">자세한 출결 기록은 출결 관리에서 확인할 수 있습니다.</p>
                            <button
                                type="button"
                                onClick={() => handlePageChange('attendance')}
                                className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white"
                            >
                                출결 관리로 이동
                            </button>
                        </div>
                    </div>
                );
            case 'classes':
                return (
                    <div className="space-y-3">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold text-gray-900">수업 요약</p>
                            <div className="mt-3 space-y-2">
                                {studentClasses.length > 0 ? studentClasses.map(cls => (
                                    <div key={cls.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                                        <p className="text-sm font-semibold text-gray-900">{cls.name}</p>
                                        <p className="text-xs text-gray-500">담당: {cls.teacher || '정보 없음'}</p>
                                    </div>
                                )) : (
                                    <p className="text-xs text-gray-500">등록된 수업이 없습니다.</p>
                                )}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold text-gray-900">클리닉 일정</p>
                            <p className="mt-2 text-sm text-gray-700">{student.clinicTime || '미정'}</p>
                        </div>
                    </div>
                );
            case 'homework':
                return (
                    <div className="space-y-3">
                        {recentHomeworks.length > 0 ? recentHomeworks.map(h => (
                            <div key={h.id} className={`rounded-2xl border p-4 shadow-sm ${h.isCompleted ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                                <p className="text-sm font-semibold text-gray-900" title={h.content}>{h.content}</p>
                                <p className="mt-1 text-xs text-gray-600">{h.book}</p>
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>완료율</span>
                                        <span className="font-semibold text-gray-700">{h.completionRate}%</span>
                                    </div>
                                    <div className="mt-2 h-2 w-full rounded-full bg-white">
                                        <div
                                            className="h-2 rounded-full"
                                            style={{ width: `${h.completionRate}%`, backgroundColor: h.isCompleted ? '#10B981' : '#F87171' }}
                                        ></div>
                                    </div>
                                    <p className={`mt-2 text-sm font-semibold ${h.isCompleted ? 'text-emerald-700' : 'text-rose-600'}`}>
                                        {h.isCompleted ? '완료' : '미완료'}
                                    </p>
                                </div>
                            </div>
                        )) : (
                            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">배정된 과제가 없습니다.</p>
                        )}
                        <button
                            type="button"
                            onClick={() => handlePageChange('homework')}
                            className="w-full rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-600"
                        >
                            과제 상세 보기
                        </button>
                    </div>
                );
            case 'grades':
                return (
                    <div className="space-y-3">
                        {recentGrades.length > 0 ? recentGrades.map((g, index) => (
                            <div key={index} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{g.testName}</p>
                                        <p className="text-xs text-gray-500">{g.className} · {g.testDate}</p>
                                    </div>
                                    <span className={`text-sm font-bold ${g.isAboveAverage ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {g.scoreDifference > 0 ? '+' : ''}{g.scoreDifference}점
                                    </span>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                                        <p className="text-gray-500">학생 점수</p>
                                        <p className="text-sm font-semibold text-gray-900">{g.studentScore}점</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                                        <p className="text-gray-500">반 평균</p>
                                        <p className="text-sm font-semibold text-indigo-600">{g.classAverage}점</p>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">기록된 성적이 없습니다.</p>
                        )}
                        <button
                            type="button"
                            onClick={() => handlePageChange('grades')}
                            className="w-full rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-600"
                        >
                            성적 상세 보기
                        </button>
                    </div>
                );
            case 'memo':
                return (
                    <div className="space-y-3">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold text-gray-900">최근 메모</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{latestMemo || '작성된 메모가 없습니다.'}</p>
                            <button
                                type="button"
                                onClick={() => setIsMemoModalOpen(true)}
                                className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white"
                            >
                                메모 작성/수정
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
                <div className="px-4 pt-4 pb-3">
                    <div className="rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.35),transparent_45%),linear-gradient(135deg,#0a1434,#1d4ed8,#0d9488)] p-4 text-white shadow-lg">
                        <p className="text-xs text-white/80">직원용 · 학생 상세</p>
                        <div className="mt-2 flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold">{student.name}</p>
                                <p className="text-xs text-white/80">{student.school} · {formatGradeLabel(student.grade)}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.status === '재원생' ? 'bg-emerald-200/30 text-emerald-50 border border-emerald-200/50' : 'bg-rose-200/30 text-rose-50 border border-rose-200/50'}`}>
                                {student.status}
                            </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl bg-white/10 px-3 py-2">
                                <p className="text-white/70">오늘 수업</p>
                                <p className="font-semibold">{student.clinicTime || '일정 확인'}</p>
                            </div>
                            <div className="rounded-xl bg-white/10 px-3 py-2">
                                <p className="text-white/70">미제출 과제</p>
                                <p className="font-semibold">{pendingHomeworkCount}개</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto px-4 pb-3">
                    {mobileTabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveMobileTab(tab.id)}
                            className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${activeMobileTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="md:hidden px-4 pb-6">
                {renderMobileContent()}
            </div>

            {isMemoModalOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 z-50 bg-black/60">
                        <div className="flex h-full flex-col bg-white">
                            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">교직원 메모</p>
                                    <p className="text-xs text-gray-500">{student.name} 학생</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsMemoModalOpen(false)}
                                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                                >
                                    <Icon name="x" className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto px-4 py-4">
                                <label className="text-xs font-semibold text-gray-600" htmlFor="memoMobileInput">메모 작성</label>
                                <textarea
                                    id="memoMobileInput"
                                    value={memoDraft}
                                    onChange={(e) => setMemoDraft(e.target.value)}
                                    className="mt-2 min-h-[60vh] w-full rounded-xl border border-gray-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    placeholder="학생에 대한 최신 메모를 입력하세요."
                                />
                            </div>
                            <div className="border-t border-gray-200 px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        saveMemo();
                                        setIsMemoModalOpen(false);
                                    }}
                                    className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white"
                                >
                                    메모 저장
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            <div className="hidden md:block space-y-6">
            <div className="bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.28),transparent_40%),radial-gradient(circle_at_80%_15%,rgba(45,212,191,0.26),transparent_38%),linear-gradient(135deg,#0a1434,#1d4ed8,#0d9488)] text-white rounded-2xl shadow-lg p-6 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm">
                        <Icon name="user" className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-white/80">직원용 · 학생 상세 대시보드</p>
                        <h3 className="text-2xl font-bold flex items-center gap-2">{student.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-semibold">
                            <span className={`px-3 py-1 rounded-full ${student.status === '재원생' ? 'bg-emerald-100/30 text-emerald-50 border border-emerald-200/40' : 'bg-rose-100/30 text-rose-50 border border-rose-200/40'}`}>
                                {student.status}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20">{student.school} · {formatGradeLabel(student.grade)}</span>
                            {student.clinicTime && (
                                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 flex items-center space-x-1">
                                    <Icon name="calendar" className="w-4 h-4" />
                                    <span>{student.clinicTime}</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => handlePageChange('grades')}
                        className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-semibold shadow-sm hover:bg-gray-50"
                    >
                        성적 관리
                    </button>
                    <button
                        onClick={() => handlePageChange('homework')}
                        className="px-4 py-2 bg-indigo-900/30 border border-white/30 text-white rounded-lg font-semibold hover:bg-indigo-900/50"
                    >
                        과제 관리
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow p-4 border border-gray-100 col-span-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                            <Icon name="user" className="w-5 h-5 text-indigo-500" />
                            <span>학생 기본 정보</span>
                        </h4>
                        <span className="text-xs text-gray-500">최근 업데이트: {student.lastUpdated || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                        <div className="space-y-1">
                            <p className="text-gray-500">학교 / 학년</p>
                            <p className="font-semibold text-gray-900">{student.school} · {formatGradeLabel(student.grade)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-gray-500">연락처</p>
                            <p className="font-semibold text-gray-900 flex items-center space-x-2">
                                <Icon name="phone" className="w-4 h-4 text-emerald-500" />
                                <span>학생: {student.phone}</span>
                            </p>
                            <p className="font-semibold text-gray-900 flex items-center space-x-2">
                                <Icon name="phone" className="w-4 h-4 text-indigo-500" />
                                <span>학부모: {student.parentPhone}</span>
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-gray-500">클래스</p>
                            <p className="font-semibold text-gray-900">{studentClasses.map(c => c.name).join(', ') || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-gray-500">클리닉</p>
                            <p className="font-semibold text-gray-900 flex items-center space-x-2">
                                <Icon name="calendar" className="w-4 h-4 text-amber-500" />
                                <span>{student.clinicTime || '미정'}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                            <Icon name="barChart" className="w-5 h-5 text-indigo-500" />
                            <span>성적 요약</span>
                        </h4>
                        <span className="text-xs text-gray-500">최근 {gradeComparison.length || 0}회</span>
                    </div>
                    <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">평균 대비</span>
                            <span className={`font-semibold ${gradeComparison[0]?.isAboveAverage ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {gradeComparison[0] ? `${gradeComparison[0].scoreDifference > 0 ? '+' : ''}${gradeComparison[0].scoreDifference}점` : '데이터 없음'}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">가장 최근 시험</span>
                            <span className="font-semibold text-gray-900">{gradeComparison[0]?.testName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">총 응시 수</span>
                            <span className="font-semibold text-gray-900">{gradeComparison.length}회</span>
                        </div>
                    </div>
                    <button
                        onClick={() => handlePageChange('grades')}
                        className="mt-4 w-full text-sm text-indigo-600 font-semibold hover:underline flex items-center justify-center space-x-1"
                    >
                        <span>성적 상세 보기</span>
                        <Icon name="chevronRight" className="w-4 h-4" />
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                            <Icon name="clipboardCheck" className="w-5 h-5 text-indigo-500" />
                            <span>과제 현황</span>
                        </h4>
                        <span className="text-xs text-gray-500">최근 {totalHomeworks}개</span>
                    </div>
                    <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">완료</span>
                            <span className="font-semibold text-emerald-600">{completedHomeworks}개</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">진행률</span>
                            <span className={`font-semibold ${homeworkCompletionRate >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>{homeworkCompletionRate}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">최근 배정</span>
                            <span className="font-semibold text-gray-900">{recentHomeworks[0]?.content || 'N/A'}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => handlePageChange('homework')}
                        className="mt-4 w-full text-sm text-indigo-600 font-semibold hover:underline flex items-center justify-center space-x-1"
                    >
                        <span>과제 상세 보기</span>
                        <Icon name="chevronRight" className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
                {/* 1. 메모 & 커뮤니케이션 */}
                <div className="col-span-1 bg-white p-6 rounded-xl shadow-md space-y-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
                            <Icon name="messageCircle" className="w-5 h-5 text-indigo-500" />
                            <span>교직원 메모</span>
                        </h4>
                        <span className="text-xs text-gray-500">최근 작성</span>
                    </div>
                    <div className="text-sm p-4 bg-indigo-50 rounded-lg border border-indigo-100 min-h-24">
                        <p className="whitespace-pre-wrap text-gray-700">{latestMemo || '작성된 메모가 없습니다.'}</p>
                    </div>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm text-gray-600 font-semibold" htmlFor="memoInput">새 메모 작성</label>
                            <textarea
                                id="memoInput"
                                value={memoDraft}
                                onChange={(e) => setMemoDraft(e.target.value)}
                                className="w-full min-h-24 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
                                placeholder="학생에 대한 최신 메모를 입력하세요."
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={saveMemo}
                                className="flex-1 p-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                            >
                                메모 저장
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePageChange('attendance')}
                                className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex items-center space-x-2 hover:border-indigo-200 hover:bg-indigo-50 transition"
                            >
                                <Icon name="schedule" className="w-4 h-4 text-indigo-500" />
                                <span className="font-semibold text-gray-800">출결 확인</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. 성적 요약 리스트 */}
                <div className="col-span-2 bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div className="flex items-center justify-between border-b pb-3">
                        <h4 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
                            <Icon name="barChart" className="w-5 h-5 text-indigo-500" />
                            <span>최근 성적 비교 (클래스 평균 대비)</span>
                        </h4>
                        <button onClick={() => handlePageChange('grades')} className='text-sm text-indigo-600 hover:underline flex items-center space-x-1'>
                            <span>전체 성적 보기</span>
                            <Icon name="chevronRight" className="w-4 h-4" />
                        </button>
                    </div>
                    {recentGrades.length > 0 ? (
                        <div className="mt-4 space-y-4">
                            {recentGrades.map((g, index) => (
                                <div key={index} className="border border-gray-100 p-4 rounded-lg bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{g.testName} · {g.className}</p>
                                            <p className="text-xs text-gray-500">{g.testDate}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${g.isAboveAverage ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {g.scoreDifference > 0 ? '+' : ''}{g.scoreDifference}점
                                            </p>
                                            <p className="text-xs text-gray-500">평균 대비</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                                            <p className="text-gray-500">학생 점수</p>
                                            <p className="font-bold text-gray-900">{g.studentScore}점 / {g.maxScore}점</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                                            <p className="text-gray-500">반 평균</p>
                                            <p className="font-bold text-indigo-600">{g.classAverage}점</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                                            <p className="text-gray-500">석차</p>
                                            <p className="font-bold text-gray-900">{g.rank ? `${g.rank}위 / ${g.totalStudents}명` : '데이터 없음'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 mt-4">기록된 성적이 없습니다.</p>
                    )}
                </div>

                {/* 3. 과제 현황 */}
                <div className="col-span-3 bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div className="flex items-center justify-between border-b pb-3">
                        <h4 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
                            <Icon name="clipboardCheck" className="w-5 h-5 text-indigo-500" />
                            <span>최근 과제 수행 현황</span>
                        </h4>
                        <button onClick={() => handlePageChange('homework')} className='text-sm text-indigo-600 hover:underline flex items-center space-x-1'>
                            <span>전체 과제 보기</span>
                            <Icon name="chevronRight" className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-4">
                        {recentHomeworks.length > 0 ? (
                            recentHomeworks.map(h => (
                                <div key={h.id} className={`p-4 rounded-lg border ${h.isCompleted ? 'border-green-400 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                    <p className="text-sm font-semibold truncate" title={h.content}>{h.content}</p>
                                    <p className="text-xs text-gray-600 mt-1">{h.book}</p>
                                    <div className="mt-3 space-y-1">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>완료율</span>
                                            <span className="font-semibold text-gray-700">{h.completionRate}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className="h-2.5 rounded-full"
                                                style={{ width: `${h.completionRate}%`, backgroundColor: h.isCompleted ? '#10B981' : '#F87171' }}
                                            ></div>
                                        </div>
                                        <p className={`text-sm font-bold ${h.isCompleted ? 'text-green-700' : 'text-red-600'}`}>{h.isCompleted ? '완료' : '미완료'}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="col-span-4 text-sm text-gray-500">배정된 과제가 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};