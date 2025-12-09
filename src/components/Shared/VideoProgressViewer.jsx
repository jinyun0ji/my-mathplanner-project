import React from 'react';
import { Icon } from '../../utils/helpers';

export default function VideoProgressViewer({ log, students, videoProgress, attendanceLogs }) {
    const classStudents = students.filter(s => {
        // 이 로그에 출석한 학생만 필터링
        return attendanceLogs.some(a => a.studentId === s.id && a.classId === log.classId && a.date === log.date && a.status === '동영상보강');
    });

    return (
        <div className="bg-white p-4 rounded-lg shadow-inner mt-4 border border-gray-200">
            <h4 className="text-lg font-bold mb-3 text-indigo-700 flex items-center">
                <Icon name="monitor" className="w-5 h-5 mr-2" />
                동영상 보강 현황 (결석생)
            </h4>
            <div className="grid grid-cols-4 gap-4">
                {classStudents.length === 0 ? (
                    <p className="col-span-4 text-sm text-gray-500">동영상 보강 대상 학생이 없습니다.</p>
                ) : (
                    classStudents.map(student => {
                        const progress = videoProgress[student.id]?.[log.id] || 0;
                        return (
                            <div key={student.id} className="p-3 border rounded-lg bg-indigo-50">
                                <p className="text-sm font-semibold">{student.name} (고{student.grade})</p>
                                <div className="mt-2">
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div 
                                            className="h-2.5 rounded-full" 
                                            style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#10B981' : '#6366F1' }}
                                        ></div>
                                    </div>
                                    <p className={`text-xs mt-1 font-bold ${progress === 100 ? 'text-green-600' : 'text-indigo-600'}`}>
                                        {progress}% 시청 완료
                                    </p>
                                </div>
                                <div className='flex justify-between items-center mt-2'>
                                    {progress < 100 && <button className='text-xs text-red-500 hover:underline'>독촉 알림</button>}
                                    <button className='text-xs text-gray-500 hover:underline'>진도 입력</button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};