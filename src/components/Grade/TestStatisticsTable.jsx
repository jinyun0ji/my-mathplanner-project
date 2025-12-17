// src/components/Grade/TestStatisticsTable.jsx

import React from 'react';
import { Icon } from '../../utils/helpers';

export default function TestStatisticsTable({ test, stats, currentStudents }) {
    
    const rankedStudents = currentStudents
        .map(student => {
            const rankInfo = stats.rank.find(r => r.studentId === student.id);
            if (!rankInfo || rankInfo.score === null) return null;
            return {
                name: student.name,
                rank: rankInfo.rank,
                score: rankInfo.score,
            };
        })
        .filter(r => r !== null) 
        .sort((a, b) => a.rank - b.rank); 

    // 🚨 수정: 요약 통계 값과 색상 정의
    const summaryItems = [
        { label: '평균 점수', value: stats.average?.toFixed(1) || '-', color: 'text-blue-600' },
        { label: '최고 점수', value: stats.maxScore?.toFixed(1) || '-', color: 'text-green-600' },
        { label: '최저 점수', value: stats.minScore?.toFixed(1) || '-', color: 'text-red-600' },
        { label: '표준 편차', value: stats.stdDev?.toFixed(2) || '-', color: 'text-gray-700' },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center">
                <Icon name="barChart" className="w-5 h-5 mr-2 text-blue-600" />
                시험 결과 통계 (읽기 전용)
            </h2>
            
            {/* 🚨 수정: 요약 통계 1행 4열 그리드, 텍스트 크기 통일 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center border p-3 rounded-lg bg-gray-50">
                {summaryItems.map((item, index) => (
                    <div key={index} className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                        {/* 🚨 text-lg로 통일 */}
                        <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            {/* 🚨 수정: 문항별 정답률 & 학생 등수 좌우 배치 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. 문항별 정답률 (2열 테이블, 스크롤 추가) */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-700">문항별 정답률</h3>
                    <div className="overflow-y-auto max-h-96 border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600 w-1/2">문항 번호</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600 w-1/2">정답률</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {Object.keys(stats.correctRates || {}).map((qNum) => {
                                    const rate = stats.correctRates[qNum];
                                    return (
                                        <tr key={qNum} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-center font-medium text-gray-900">{qNum}번</td>
                                            <td className="px-3 py-2 text-center font-bold">
                                                <span className={`${rate >= 0.7 ? 'text-green-600' : rate >= 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {(rate * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            
                {/* 2. 학생 등수 (스크롤 추가) */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-700">학생 등수</h3>
                    <div className="overflow-y-auto max-h-96 border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600 w-16">순위</th>
                                    <th className="px-3 py-2 text-left font-bold text-gray-600">학생명</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600 w-24">점수</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {rankedStudents.length > 0 ? rankedStudents.map((student, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-center font-bold text-gray-800">
                                        {student.rank}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-gray-900">{student.name}</td>
                                    <td className="px-3 py-2 text-center text-blue-600 font-semibold">{student.score.toFixed(1)}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="3" className="text-center py-4 text-gray-500">채점된 성적이 없습니다.</td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
        </div>
    );
};