import React, { useMemo } from 'react';
import { Icon } from '../utils/helpers';
// calculateGradeComparison, calculateHomeworkStats는 App.jsx에서 props로 전달받음

export default function StudentDetail({ 
    studentId, students, classes, studentMemos, grades, tests, homeworkAssignments, homeworkResults, handlePageChange, 
    calculateGradeComparison, calculateHomeworkStats 
}) {
    const student = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);
    
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
    
    const studentClasses = student.classes.map(id => classes.find(c => c.id === id)).filter(c => c);
    
    // 유틸리티 함수를 이용한 데이터 계산 (App.jsx에서 props로 전달)
    const gradeComparison = calculateGradeComparison(studentId, classes, tests, grades);
    const homeworkStats = calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults);
    
    // 최근 성적 4개만 표시
    const recentGrades = gradeComparison.slice(-4).reverse();
    
    // 최근 과제 4개만 표시
    const recentHomeworks = homeworkStats.slice(0, 4);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
                <div className='flex items-center space-x-4'>
                    <button 
                        onClick={() => handlePageChange('students')} 
                        className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition duration-150"
                        title="학생 목록으로 돌아가기"
                    >
                        <Icon name="arrow-left" className="w-6 h-6"/>
                    </button>
                    <h3 className="text-2xl font-bold text-gray-800">
                        {student.name} 학생 상세 대시보드
                    </h3>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
                {/* 1. 기본 정보 & 메모 */}
                <div className="col-span-1 bg-white p-6 rounded-xl shadow-md space-y-3 h-full">
                    <h4 className="text-lg font-bold border-b pb-2 text-gray-800">기본 정보</h4>
                    <p className="text-sm"><span className="font-medium text-gray-600">상태:</span> <span className={`font-bold ${student.status === '재원생' ? 'text-green-600' : 'text-red-600'}`}>{student.status}</span></p>
                    <p className="text-sm"><span className="font-medium text-gray-600">학교/학년:</span> {student.school} (고{student.grade})</p>
                    <p className="text-sm"><span className="font-medium text-gray-600">클래스:</span> <span className="font-medium text-blue-600">{studentClasses.map(c => c.name).join(', ') || '-'}</span></p>
                    <p className="text-sm"><span className="font-medium text-gray-600">연락처:</span> {student.phone} / {student.parentPhone}</p>
                    <p className="text-sm"><span className="font-medium text-gray-600">클리닉:</span> {student.clinicTime || '미정'}</p>
                    
                    <h4 className="text-lg font-bold border-b pt-4 pb-2 text-gray-800">교직원 메모</h4>
                    <div className="text-sm p-3 bg-yellow-50 rounded-lg border border-yellow-200 min-h-20">
                        <p className="whitespace-pre-wrap text-gray-700">{studentMemos[studentId] || '작성된 메모가 없습니다.'}</p>
                    </div>
                </div>

                {/* 2. 성적 요약 그래프 */}
                <div className="col-span-2 bg-white p-6 rounded-xl shadow-md">
                    <h4 className="text-lg font-bold border-b pb-2 text-gray-800 flex justify-between items-center">
                        최근 성적 비교 (클래스 평균 대비)
                        <button onClick={() => handlePageChange('grades')} className='text-sm text-indigo-600 hover:underline'>전체 성적 보기</button>
                    </h4>
                    {recentGrades.length > 0 ? (
                        <div className="mt-4 space-y-4">
                            {recentGrades.map((g, index) => (
                                <div key={index} className="border p-3 rounded-lg bg-gray-50">
                                    <p className="text-sm font-semibold">{g.testName} ({g.className})</p>
                                    <div className="flex items-center mt-1">
                                        <div className="flex-1 mr-4">
                                            <p className="text-xs text-gray-600">학생 점수: <span className="font-bold text-red-600">{g.studentScore}점</span></p>
                                            <p className="text-xs text-gray-600">평균 점수: <span className="font-bold text-blue-600">{g.classAverage}점</span></p>
                                        </div>
                                        <div className="w-1/3 text-center">
                                            <p className={`font-bold ${g.isAboveAverage ? 'text-green-600' : 'text-red-600'}`}>
                                                {g.scoreDifference}점 {g.isAboveAverage ? '⬆️' : '⬇️'}
                                            </p>
                                            <p className="text-xs text-gray-500">평균과의 차이</p>
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
                <div className="col-span-3 bg-white p-6 rounded-xl shadow-md">
                    <h4 className="text-lg font-bold border-b pb-2 text-gray-800 flex justify-between items-center">
                        최근 과제 수행 현황
                        <button onClick={() => handlePageChange('homework')} className='text-sm text-indigo-600 hover:underline'>전체 과제 보기</button>
                    </h4>
                    <div className="mt-4 grid grid-cols-4 gap-4">
                        {recentHomeworks.length > 0 ? (
                            recentHomeworks.map(h => (
                                <div key={h.id} className={`p-4 rounded-lg border ${h.isCompleted ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
                                    <p className="text-sm font-semibold truncate" title={h.content}>{h.content}</p>
                                    <p className="text-xs text-gray-600 mt-1">{h.book}</p>
                                    <div className="mt-2">
                                        <p className="text-xs text-gray-500">완료율</p>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div 
                                                className="h-2.5 rounded-full" 
                                                style={{ width: `${h.completionRate}%`, backgroundColor: h.isCompleted ? '#10B981' : '#F87171' }}
                                            ></div>
                                        </div>
                                        <p className={`text-sm font-bold mt-1 ${h.isCompleted ? 'text-green-600' : 'text-red-600'}`}>{h.completionRate}%</p>
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
    );
};