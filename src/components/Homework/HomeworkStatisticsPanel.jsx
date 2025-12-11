// src/components/Homework/HomeworkStatisticsPanel.jsx
import React, { useMemo } from 'react';
import { Icon } from '../../utils/helpers';

export default function HomeworkStatisticsPanel({ assignment, summary }) {
    // 통계 계산
    const stats = useMemo(() => {
        if (!summary || summary.length === 0) return null;

        const totalStudents = summary.length;
        const totalCompletionRate = summary.reduce((acc, curr) => acc + curr.completionRate, 0);
        const averageCompletionRate = Math.round(totalCompletionRate / totalStudents);
        
        const completedCount = summary.filter(s => s.isCompleted).length;
        const incompleteCount = totalStudents - completedCount;

        // 문항별 정답/오답/고침 분석
        const questionStats = {};
        summary.forEach(student => {
            Object.entries(student.resultMap).forEach(([qNum, status]) => {
                // 채점된 문항만 집계
                if (status) {
                    if (!questionStats[qNum]) questionStats[qNum] = { correct: 0, incorrect: 0, corrected: 0 };
                    
                    if (status === '맞음') questionStats[qNum].correct++;
                    else if (status === '틀림') questionStats[qNum].incorrect++;
                    else if (status === '고침') questionStats[qNum].corrected++;
                }
            });
        });

        // ✅ [수정] Top 5 제한(slice) 제거하여 전체 문항 포함
        const allQuestionsSorted = Object.entries(questionStats)
            .map(([qNum, data]) => {
                const totalAttempts = data.correct + data.incorrect + data.corrected;
                // '정답'은 '맞음'과 '고침'을 합산합니다.
                const totalCorrect = data.correct + data.corrected; 
                
                const correctRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
                
                return {
                    qNum: Number(qNum), // 정렬을 위해 숫자로 변환
                    originalQNum: qNum,
                    totalCorrect,
                    totalAttempts,
                    rate: correctRate // 정답률
                };
            })
            .filter(item => item.totalAttempts > 0) // 풀이 시도가 있는 문항만
            // 정렬 기준: 1. 정답률 낮은 순 (오름차순) 2. 정답률 같으면 문항 번호 순
            .sort((a, b) => a.rate - b.rate || a.qNum - b.qNum);

        return {
            averageCompletionRate,
            completedCount,
            incompleteCount,
            allQuestionsSorted, // 전체 문항 리스트
            totalStudents,
            // 학생별 완료율 정렬 (미완료자 우선)
            sortedStudents: [...summary].sort((a, b) => a.completionRate - b.completionRate)
        };
    }, [summary]);

    if (!stats) return null;

    // 요약 아이템 설정
    const summaryItems = [
        { label: '평균 수행률', value: `${stats.averageCompletionRate}%`, color: 'text-blue-600' },
        { label: '완료 학생', value: `${stats.completedCount}명`, color: 'text-green-600' },
        { label: '미완료 학생', value: `${stats.incompleteCount}명`, color: 'text-red-600' },
        { label: '총원', value: `${stats.totalStudents}명`, color: 'text-gray-700' },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center">
                <Icon name="pieChart" className="w-5 h-5 mr-2 text-blue-600" />
                과제 결과 통계
            </h2>
            
            {/* 요약 그리드 */}
            <div className="grid grid-cols-4 gap-4 text-center border p-3 rounded-lg bg-gray-50">
                {summaryItems.map((item, index) => (
                    <div key={index} className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                        <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* 1. 문항별 정답률 테이블 (전체 문항) */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                        <Icon name="barChart" className="w-4 h-4 mr-2 text-blue-500" />
                        문항별 정답률 (전체, 낮은 순)
                    </h3>
                    <div className="overflow-y-auto max-h-96 border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600 w-16">순위</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600">문항 번호</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600">정답률 (인원)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stats.allQuestionsSorted.length > 0 ? (
                                    stats.allQuestionsSorted.map((q, idx) => (
                                        <tr key={q.originalQNum} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-center font-bold text-gray-500">{idx + 1}</td>
                                            <td className="px-3 py-2 text-center font-medium text-gray-900">{q.originalQNum}번</td>
                                            <td className="px-3 py-2 text-center font-bold">
                                                <span className={`${q.rate < 50 ? 'text-red-600' : q.rate < 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                    {q.rate}% 
                                                </span>
                                                <span className='text-gray-500 ml-1 font-normal'>
                                                    ({q.totalCorrect}명/{q.totalAttempts}명)
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="3" className="text-center py-4 text-gray-500">채점된 데이터가 부족합니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            
                {/* 2. 학생별 수행 현황 테이블 */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                        <Icon name="users" className="w-4 h-4 mr-2 text-indigo-500" />
                        학생별 수행 현황
                    </h3>
                    <div className="overflow-y-auto max-h-96 border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left font-bold text-gray-600">학생명</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600">상태</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600">수행률</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stats.sortedStudents.map((student) => (
                                    <tr key={student.studentId} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 font-medium text-gray-900">{student.studentName}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${student.isCompleted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {student.isCompleted ? '완료' : '미완료'}
                                            </span>
                                        </td>
                                        <td className={`px-3 py-2 text-center font-bold ${student.completionRate === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                                            {student.completionRate}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};