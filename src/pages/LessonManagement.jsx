// src/pages/LessonManagement.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../utils/helpers';
import { LessonLogFormModal } from '../utils/modals/LessonLogFormModal';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel'; 
import VideoProgressViewer from '../components/Shared/VideoProgressViewer'; 

export default function LessonManagement({ 
    students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog, 
    handleSaveClass, videoProgress, attendanceLogs, calculateClassSessions, logNotification 
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
        // 수정된 로직: 현재 선택된 날짜가 null이거나, 클래스가 변경되었을 때만
        // 가장 최근 일지의 날짜로 설정합니다. (날짜 선택 유지)
        if (selectedClassId) {
            if (selectedDate === null && classLogs.length > 0) {
                 setSelectedDate(classLogs[0].date);
            } else if (classLogs.length === 0) {
                 setSelectedDate(null);
            }
        }
        // selectedDate를 dependency에서 제거하고, null 체크 로직을 강화하여 무한 루프/강제 리셋을 방지합니다.
    }, [selectedClassId, classLogs.length]); 

    const currentLog = useMemo(() => {
        return classLogs.find(log => log.date === selectedDate);
    }, [classLogs, selectedDate]);
    
    // (LessonManagement에서 사용하지 않지만, props로 전달하는 함수를 위해 남겨둡니다.)
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
                            className={`p-2 rounded-lg transition cursor-pointer flex justify-between items-center ${
                                isSelected 
                                    ? 'bg-blue-100 font-bold text-blue-700 border border-blue-300' 
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <span>
                                <span className="font-mono text-xs mr-2">{session.date}</span>
                                {session.session}회차
                            </span>
                            {isLogged && <Icon name="check" className="w-4 h-4 text-green-500" title="일지 작성 완료" />}
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
        // ✅ 수정: items-start를 추가하여 좌측 패널이 우측 내용 길이에 맞춰 늘어나는 것을 방지
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
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">왼쪽에서 클래스를 선택하여 일지를 확인하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedClass.name} | 
                                <span className="text-indigo-600 ml-2">{selectedDate}</span>
                            </h3>
                            <div className='flex space-x-3'>
                                {isCurrentDateLogged && (
                                    <button 
                                        onClick={() => handleEditLog(currentLog)}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                                    >
                                        <Icon name="edit" className="w-5 h-5 mr-2" />
                                        일지 수정
                                    </button>
                                )}
                                <button 
                                    onClick={handleNewLog}
                                    className={`font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150 ${isCurrentDateLogged ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                                >
                                    <Icon name="plus" className="w-5 h-5 mr-2" />
                                    {isCurrentDateLogged ? '새로운 일지 작성' : '일지 작성'}
                                </button>
                            </div>
                        </div>

                        {/* 일지 내용 */}
                        {currentLog ? (
                            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                                <h4 className="text-lg font-bold text-gray-800 border-b pb-2">수업 진도 및 내용</h4>
                                <div className="text-gray-700 whitespace-pre-wrap">{currentLog.progress}</div>

                                {currentLog.materialUrl && (
                                    <p className="text-sm font-medium text-blue-600 flex items-center border-t pt-4">
                                        <Icon name="fileText" className="w-4 h-4 mr-2"/>
                                        첨부 자료: <a href={currentLog.materialUrl} target="_blank" rel="noopener noreferrer" className="ml-1 hover:underline">{currentLog.materialUrl}</a>
                                    </p>
                                )}
                                
                                {currentLog.iframeCode && (
                                    <div className="border border-gray-300 rounded-lg overflow-hidden mt-4">
                                        <div className="aspect-w-16 aspect-h-9" dangerouslySetInnerHTML={{ __html: currentLog.iframeCode }} />
                                    </div>
                                )}

                                {/* 동영상 보강 현황 (로그가 있을 경우에만 표시) */}
                                {currentLog.iframeCode && (
                                    <VideoProgressViewer 
                                        log={currentLog} 
                                        students={students} 
                                        videoProgress={videoProgress} 
                                        attendanceLogs={attendanceLogs} 
                                    />
                                )}

                                <div className='pt-4 border-t flex justify-end'>
                                    <button
                                        onClick={() => { if(window.confirm('정말 이 수업 일지를 삭제하시겠습니까?')) handleDeleteLessonLog(currentLog.id) }}
                                        className='text-sm text-red-500 hover:text-red-700 flex items-center'
                                    >
                                        <Icon name="trash" className="w-4 h-4 mr-1"/>
                                        일지 삭제
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-6 rounded-xl shadow-md">
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