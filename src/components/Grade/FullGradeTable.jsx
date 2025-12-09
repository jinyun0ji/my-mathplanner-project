import React from 'react';
import { Icon } from '../../utils/helpers'; // 경로 수정

export default function FullGradeTable({ classStudents, classTests, grades, classAverages, handleEditTest, handleDeleteTest, handleOpenResultModal }) {
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
            <h4 className="text-lg font-bold mb-4 border-b pb-2">전체 시험 성적 상세</h4>
            <div className='max-h-[70vh] overflow-y-auto'>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="w-32 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 border-r z-10">학생명</th>
                            {classTests.map(test => (
                                <th key={test.id} className="w-32 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    <div className='flex flex-col'>
                                        <span className='font-bold text-gray-700'>{test.name}</span>
                                        <span className='font-normal text-xs text-red-500'>{test.maxScore}점 만점</span>
                                        <div className='flex justify-center space-x-1 mt-1'>
                                            <button onClick={(e) => {e.stopPropagation(); handleEditTest(test);}} className='text-blue-500 hover:text-blue-700' title="시험 정보 수정"><Icon name="edit" className="w-3 h-3"/></button>
                                            <button onClick={(e) => {e.stopPropagation(); if(window.confirm('시험을 삭제하면 모든 성적도 삭제됩니다.')) handleDeleteTest(test.id);}} className='text-red-500 hover:text-red-700' title="시험 삭제"><Icon name="trash" className="w-3 h-3"/></button>
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                        {/* 평균 점수 행 */}
                        <tr>
                            <th className="px-6 py-2 text-left text-xs font-bold text-gray-700 sticky left-0 bg-gray-100 border-r z-10">클래스 평균</th>
                            {classTests.map(test => (
                                <th key={test.id} className="px-4 py-2 text-center text-sm font-bold bg-gray-100">
                                    {classAverages[test.id] ? classAverages[test.id].toFixed(1) + '점' : '-'}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {classStudents.map(student => (
                            <tr key={student.id} className="hover:bg-gray-50 text-xs">
                                <td className="px-6 py-2 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-1 border-r text-sm">
                                    {student.name}
                                </td>
                                {classTests.map(test => {
                                    const scoreData = grades[student.id]?.[test.id] || {};
                                    // 소수점 첫째 자리까지 표시되도록 조정
                                    const score = scoreData.score === undefined ? '-' : 
                                                  scoreData.score === null ? '미응시' : Number(scoreData.score).toFixed(1);
                                    
                                    return (
                                        <td key={test.id} className="px-4 py-2 whitespace-nowrap text-center cursor-pointer hover:bg-red-50/30" onClick={() => handleOpenResultModal(test)}>
                                            {/* 🚨 글자 크기 조정 및 "점" 텍스트 나란히 배치 */}
                                            <span className={`font-bold text-sm ${score === '미응시' ? 'text-red-500' : 'text-gray-800'}`}>
                                                {score === '-' ? '-' : score}
                                                {score !== '-' && score !== '미응시' && <span className="text-xs font-normal ml-0.5">점</span>}
                                            </span>
                                            {score !== '-' && score !== '미응시' && (
                                                <p className='text-xs text-blue-500 hover:underline'>채점</p>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};