import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../utils/helpers';
import { LessonLogFormModal } from '../utils/modals/LessonLogFormModal';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel'; 
import VideoProgressViewer from '../components/Shared/VideoProgressViewer'; 

export default function LessonManagement({ 
    students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog, 
    handleSaveClass, videoProgress, attendanceLogs, calculateClassSessions, logNotification, handleSendStudentNotification
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 선택된 클래스의 일지 목록을 날짜 역순으로 정렬
    const classLogs = useMemo(() => {
        if (!selectedClassId) return [];
        return lessonLogs
            .filter(log => log.classId === selectedClassId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [lessonLogs, selectedClassId]);

    useEffect(() => {
        if (selectedClassId) {
            if (selectedDate === null && classLogs.length > 0) {
                 setSelectedDate(classLogs[0].date);
            } else if (classLogs.length === 0) {
                 setSelectedDate(null);
            }
        }
    }, [selectedClassId, classLogs.length]); 

    const currentLog = useMemo(() => {
        return classLogs.find(log => log.date === selectedDate);
    }, [classLogs, selectedDate]);
    
    const handleDateNavigate = (direction) => {
        const sessions = calculateClassSessions(selectedClass);
        const currentIndex = sessions.findIndex(s => s.date === selectedDate);

        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < sessions.length) {
            setSelectedDate(sessions[newIndex].date);
        }
    };
    
    // ClassSelectionPanel의 커스텀 회차 목록 (로그가 있는 날짜만 표시)
    const logSessionsContent = useMemo(() => {
        const loggedDates = classLogs.map(log => log.date);
        const sessions = calculateClassSessions(selectedClass);
        
        return (
            <ul className="space-y-1 max-h-48 overflow-y-auto pr-2 text-sm">
                {[...sessions].reverse().map(session => {
                    const isLogged = loggedDates.includes(session.date);
                    const isSelected = session.date === selectedDate;
                    
                    if (!isLogged && !isSelected) return null;

                    return (
                        <li 
                            key={session.date} 
                            onClick={() => setSelectedDate(session.date)}
                            // [색상 변경] 선택된 항목: bg-blue-100 -> bg-indigo-50, text-blue-700 -> text-indigo-900
                            className={`p-2 rounded-lg transition cursor-pointer flex justify-between items-center ${
                                isSelected 
                                    ? 'bg-indigo-50 font-bold text-indigo-900 border border-indigo-200' 
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <span>
                                <span className="font-mono text-xs mr-2">{session.date}</span>
                                {session.session}회차
                            </span>
                            {isLogged && <Icon name="check" className="w-4 h-4 text-green-600" title="일지 작성 완료" />}
                        </li>
                    );
                })}
            </ul>
        );
    }, [classLogs, selectedClass, selectedDate, calculateClassSessions]);

    const handleEditLog = (log) => {
        setLogToEdit(log);
        setIsLogModalOpen(true);
    };

    const handleNewLog = () => {
        setLogToEdit(null);
        setIsLogModalOpen(true);
    };

    const isCurrentDateLogged = currentLog !== undefined;
    
    return (
        <div className="flex space-x-6 h-full items-start"> 
            <ClassSelectionPanel
                classes={classes}
                selectedClassId={selectedClassId}
                setSelectedClassId={setSelectedClassId}
                handleClassSave={handleSaveClass}
                calculateClassSessions={calculateClassSessions}
                showSessions={true}
                selectedDate={selectedDate}
                handleDateNavigate={handleDateNavigate}
                showEditButton={true}
                customPanelContent={logSessionsContent}
                customPanelTitle="수업 일지 회차"
                onDateSelect={setSelectedDate} 
            />

            <div className="flex-1 min-w-0">
                {selectedClassId === null ? (
                    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                        <p className="text-gray-500">왼쪽에서 클래스를 선택하여 일지를 확인하세요.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* [색상 변경] border-indigo-500 -> border-indigo-900 */}
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-900">
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedClass.name} | 
                                {/* [색상 변경] text-indigo-600 -> text-indigo-900 */}
                                <span className="text-indigo-900 ml-2">{selectedDate}</span>
                            </h3>
                            <div className='flex space-x-3'>
                                {isCurrentDateLogged && (
                                    // [색상 변경] 노란색 버튼은 유지하되 톤 다운 고려 (여기서는 가독성을 위해 기존 유지하거나 약간 조정)
                                    // bg-yellow-500 -> bg-white border (Secondary Style)로 변경하여 깔끔하게 처리
                                    <button 
                                        onClick={() => handleEditLog(currentLog)}
                                        className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg flex items-center shadow-sm transition duration-150"
                                    >
                                        <Icon name="edit" className="w-5 h-5 mr-2 text-gray-500" />
                                        일지 수정
                                    </button>
                                )}
                                <button 
                                    onClick={handleNewLog}
                                    // [색상 변경] bg-indigo-600 -> bg-indigo-900
                                    className={`font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150 ${
                                        isCurrentDateLogged 
                                            ? 'bg-gray-800 hover:bg-gray-900 text-white' 
                                            : 'bg-indigo-900 hover:bg-indigo-800 text-white'
                                    }`}
                                >
                                    <Icon name="plus" className="w-5 h-5 mr-2" />
                                    {isCurrentDateLogged ? '새로운 일지 작성' : '일지 작성'}
                                </button>
                            </div>
                        </div>

                        {/* 일지 내용 */}
                        {currentLog ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                                <h4 className="text-lg font-bold text-gray-800 border-b pb-2">수업 진도 및 내용</h4>
                                <div className="text-gray-700 whitespace-pre-wrap">{currentLog.progress}</div>

                                {currentLog.materialUrl && (
                                    // [색상 변경] text-blue-600 -> text-indigo-600
                                    <p className="text-sm font-medium text-indigo-600 flex items-center border-t pt-4">
                                        <Icon name="fileText" className="w-4 h-4 mr-2"/>
                                        첨부 자료: <a href={currentLog.materialUrl} target="_blank" rel="noopener noreferrer" className="ml-1 hover:underline">{currentLog.materialUrl}</a>
                                    </p>
                                )}
                                
                                {currentLog.iframeCode && (
                                    <div className="border border-gray-300 rounded-lg overflow-hidden mt-4">
                                        <div className="aspect-w-16 aspect-h-9" dangerouslySetInnerHTML={{ __html: currentLog.iframeCode }} />
                                    </div>
                                )}

                                {/* 동영상 보강 현황 */}
                                {currentLog.iframeCode && (
                                    <VideoProgressViewer 
                                        log={currentLog} 
                                        students={students} 
                                        videoProgress={videoProgress} 
                                        attendanceLogs={attendanceLogs} 
                                        logNotification={logNotification}
                                        handleSendStudentNotification={handleSendStudentNotification} // ✅ [추가] 전달
                                    />
                                )}

                                <div className='pt-4 border-t flex justify-end'>
                                    <button
                                        onClick={() => { if(window.confirm('정말 이 수업 일지를 삭제하시겠습니까?')) handleDeleteLessonLog(currentLog.id) }}
                                        className='text-sm text-red-500 hover:text-red-700 flex items-center font-medium'
                                    >
                                        <Icon name="trash" className="w-4 h-4 mr-1"/>
                                        일지 삭제
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <p className="text-gray-500">선택된 날짜({selectedDate})에 작성된 수업 일지가 없습니다. 새로 작성해주세요.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <LessonLogFormModal
                isOpen={isLogModalOpen}
                onClose={() => setIsLogModalOpen(false)}
                onSave={handleSaveLessonLog}
                log={logToEdit}
                classId={selectedClassId}
                classes={classes}
                calculateClassSessions={calculateClassSessions}
                defaultDate={selectedDate}
                students={students}
                logNotification={logNotification}
            />
        </div>
    );
};