import React, { useMemo, useRef } from 'react';

const RESULT_OPTIONS_HOMEWORK = { 
    '맞음': 'text-green-600 bg-green-100', 
    '틀림': 'text-red-600 bg-red-100', 
    '고침': 'text-blue-600 bg-blue-100' 
};

export default function HomeworkGradingTable({ summary, assignment, handleUpdateResult }) {
    
    // 셀 포커스 이동을 위한 Refs 저장소
    const cellRefs = useRef({});

    // 문제 번호 배열 생성
    const questions = useMemo(() => {
        if (assignment.rangeString) {
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
            const list = [];
            for (let i = assignment.startQuestion; i <= assignment.endQuestion; i++) {
                list.push(i);
            }
            return list;
        } else {
            return Array.from({ length: assignment.totalQuestions }, (_, i) => i + 1);
        }
    }, [assignment]);

    // 상태 변경 핸들러 (토글 기능)
    const handleStatusChange = (studentId, qNum, currentStatus) => {
        let newStatus;
        if (currentStatus === '맞음') newStatus = '틀림';
        else if (currentStatus === '틀림') newStatus = '고침';
        else if (currentStatus === '고침') newStatus = null; 
        else newStatus = '맞음'; 
        
        handleUpdateResult(studentId, assignment.id, qNum.toString(), newStatus);
    };

    // 키보드 입력 핸들러
    const handleKeyDown = (e, studentId, qNum, sIndex, qIndex) => {
        // 1: 맞음, 2: 틀림, 3: 고침, Delete/Backspace: 삭제
        if (['1', '2', '3'].includes(e.key)) {
            e.preventDefault();
            const statusMap = { '1': '맞음', '2': '틀림', '3': '고침' };
            handleUpdateResult(studentId, assignment.id, qNum.toString(), statusMap[e.key]);
            
            // 입력 후 오른쪽 칸으로 이동
            if (qIndex < questions.length - 1) {
                const nextEl = cellRefs.current[`${studentId}-${questions[qIndex + 1]}`];
                if (nextEl) nextEl.focus();
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            handleUpdateResult(studentId, assignment.id, qNum.toString(), null);
        }
        
        // 방향키 이동 로직
        else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (qIndex < questions.length - 1) {
                const nextEl = cellRefs.current[`${studentId}-${questions[qIndex + 1]}`];
                if (nextEl) nextEl.focus();
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (qIndex > 0) {
                const prevEl = cellRefs.current[`${studentId}-${questions[qIndex - 1]}`];
                if (prevEl) prevEl.focus();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (sIndex < summary.length - 1) {
                const nextStudentId = summary[sIndex + 1].studentId;
                const nextEl = cellRefs.current[`${nextStudentId}-${qNum}`];
                if (nextEl) nextEl.focus();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (sIndex > 0) {
                const prevStudentId = summary[sIndex - 1].studentId;
                const prevEl = cellRefs.current[`${prevStudentId}-${qNum}`];
                if (prevEl) prevEl.focus();
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
            <h4 className="text-lg font-bold mb-4 border-b pb-2">과제 채점 현황 (키보드 1, 2, 3 입력 및 방향키 이동 가능)</h4>
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
                        {summary.map((s, sIndex) => (
                            <tr key={s.studentId} className="hover:bg-gray-50">
                                <td className="w-16 px-4 py-2 whitespace-nowrap font-semibold text-gray-900 sticky left-0 bg-white hover:bg-gray-50 border-r z-10">{s.studentName}</td>
                                <td className={`w-20 px-4 py-2 whitespace-nowrap text-center font-bold ${s.completionRate === 100 ? 'text-green-600' : (s.completionRate > 0 ? 'text-blue-600' : 'text-red-500')}`}>
                                    {s.completionRate}%
                                </td>
                                {questions.map((q, qIndex) => {
                                    const status = s.resultMap[q.toString()];
                                    const statusClass = status ? RESULT_OPTIONS_HOMEWORK[status] : 'bg-gray-200 text-gray-500';
                                    
                                    return (
                                        <td 
                                            key={q} 
                                            // tabIndex 추가하여 포커스 가능하게 만듦
                                            tabIndex={0}
                                            // ref 연결
                                            ref={el => cellRefs.current[`${s.studentId}-${q}`] = el}
                                            onClick={() => handleStatusChange(s.studentId, q, status)}
                                            // 키보드 핸들러 추가
                                            onKeyDown={(e) => handleKeyDown(e, s.studentId, q, sIndex, qIndex)}
                                            className={`w-8 p-1 text-center cursor-pointer transition duration-100 ${statusClass} border-l focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-20`}
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
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span> 1. 맞음</p>
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span> 2. 틀림</p>
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span> 3. 고침</p>
                <p className="flex items-center text-gray-500"><span className="w-3 h-3 rounded-full bg-gray-500 mr-1"></span> Del. 삭제</p>
            </div>
        </div>
    );
};