// src/components/Shared/VideoProgressViewer.jsx
import React from 'react';
import { Icon } from '../../utils/helpers';

// ✅ [수정] handleSendStudentNotification prop 추가
export default function VideoProgressViewer({ log, students, videoProgress, attendanceLogs, logNotification, handleSendStudentNotification }) {
    const classStudents = students.filter(s => {
        return attendanceLogs.some(a => a.studentId === s.id && a.classId === log.classId && a.date === log.date && a.status === '동영상보강');
    });

    // ✅ [수정] 독촉 알림 핸들러 (ID와 이름 모두 받음)
    const handleRemind = (studentId, studentName) => {
        const title = '영상 수강 독촉 알림 🚨';
        const content = `${studentName} 학생, [${log.date} ${log.progress}] 강의 수강이 지연되고 있습니다.<br/>서둘러 수강해주세요!`;
        
        // 실제 데이터 전송 (App.jsx의 handleSendStudentNotification 호출)
        if (handleSendStudentNotification) {
            handleSendStudentNotification(studentId, title, content);
        } else if (logNotification) {
            // fallback (함수가 없을 경우 기존 방식)
            logNotification('info', '독촉 알림 전송', `${studentName} 학생에게 알림을 보냈습니다.`);
        }
    };

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
                        const progressData = videoProgress[student.id]?.[log.id];
                        const progress = progressData?.percent || 0; 

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
                                <div className='flex justify-end items-center mt-2'>
                                    {progress < 100 && (
                                        <button 
                                            // ✅ [수정] student.id도 함께 전달
                                            onClick={() => handleRemind(student.id, student.name)}
                                            className='text-xs text-red-500 hover:text-red-700 hover:underline flex items-center'
                                        >
                                            <Icon name="bell" className="w-3 h-3 mr-1" />
                                            독촉 알림
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};