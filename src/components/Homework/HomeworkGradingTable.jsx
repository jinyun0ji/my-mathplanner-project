import React, { useMemo } from 'react';
import { Icon } from '../../utils/helpers'; 

const RESULT_OPTIONS_HOMEWORK = { '맞음': 'text-green-600 bg-green-100', '틀림': 'text-red-600 bg-red-100', '고침': 'text-blue-600 bg-blue-100' };

export default function HomeworkGradingTable({ summary, assignment, handleUpdateResult }) {
    
    // ✅ assignment 정보를 바탕으로 문제 번호 배열 생성
    const questions = useMemo(() => {
        if (assignment.rangeString) {
            // 1. 신규 방식: 문자열 파싱 (HomeworkAssignmentModal과 동일 로직)
            try {
                const parts = assignment.rangeString.split(',').map(s => s.trim()).filter(s => s !== '');
                const nums = new Set();
                parts.forEach(part => {
                    if (part.includes('-') || part.includes('~')) {
                        const [start, end] = part.split(/-|~/).map(Number);
                        if (!isNaN(start) && !isNaN(end)) {
                            for (let i = start; i <= end; i++) nums.add(i);
                        }
                    } else {
                        const num = Number(part);
                        if (!isNaN(num)) nums.add(num);
                    }
                });
                return Array.from(nums).sort((a, b) => a - b);
            } catch (e) {
                return Array.from({ length: assignment.totalQuestions }, (_, i) => i + 1);
            }
        } else if (assignment.startQuestion && assignment.endQuestion) {
            // 2. 구형 데이터 호환: start~end 범위 생성
            const list = [];
            for (let i = assignment.startQuestion; i <= assignment.endQuestion; i++) {
                list.push(i);
            }
            return list;
        } else {
            // 3. 기본값 (1부터 N까지)
            return Array.from({ length: assignment.totalQuestions }, (_, i) => i + 1);
        }
    }, [assignment]);

    const handleStatusChange = (studentId, qNum, currentStatus) => {
        let newStatus;
        if (currentStatus === '맞음') newStatus = '틀림';
        else if (currentStatus === '틀림') newStatus = '고침';
        else if (currentStatus === '고침') newStatus = null; // 초기화
        else newStatus = '맞음'; // 미기록 -> 맞음
        
        handleUpdateResult(studentId, assignment.id, qNum.toString(), newStatus);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
            <h4 className="text-lg font-bold mb-4 border-b pb-2">과제 채점 현황 (클릭하여 상태 변경)</h4>
            <div className='max-h-[60vh] overflow-y-auto'>
                <table className="min-w-full divide-y divide-gray-200 text-xs table-fixed">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                        <tr>
                            <th className="w-16 px-4 py-3 text-left font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 border-r z-30">학생명</th>
                            <th className="w-20 px-4 py-3 text-center font-medium text-gray-500 uppercase">완료율</th>
                            {questions.map(q => (
                                <th key={q} className="w-8 px-1 py-3 text-center font-medium text-gray-500 border-l">{q}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {summary.map(s => (
                            <tr key={s.studentId} className="hover:bg-gray-50">
                                <td className="w-16 px-4 py-2 whitespace-nowrap font-semibold text-gray-900 sticky left-0 bg-white hover:bg-gray-50 border-r z-10">{s.studentName}</td>
                                <td className={`w-20 px-4 py-2 whitespace-nowrap text-center font-bold ${s.completionRate === 100 ? 'text-green-600' : (s.completionRate > 0 ? 'text-blue-600' : 'text-red-500')}`}>
                                    {s.completionRate}%
                                </td>
                                {questions.map(q => {
                                    const status = s.resultMap[q.toString()];
                                    const statusClass = status ? RESULT_OPTIONS_HOMEWORK[status] : 'bg-gray-200 text-gray-500';
                                    
                                    return (
                                        <td 
                                            key={q} 
                                            onClick={() => handleStatusChange(s.studentId, q, status)}
                                            className={`w-8 p-1 text-center cursor-pointer transition duration-100 ${statusClass} border-l`}
                                        >
                                            {status ? status[0] : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex space-x-4 text-sm">
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span> 맞음</p>
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span> 틀림</p>
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span> 고침</p>
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-gray-500 mr-1"></span> 미기록</p>
            </div>
        </div>
    );
};