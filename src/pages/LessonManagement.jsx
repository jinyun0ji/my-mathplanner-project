import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../utils/helpers';
import { LessonLogFormModal } from '../utils/modals/LessonLogFormModal';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel';
import VideoProgressViewer from '../components/Shared/VideoProgressViewer';
import { buildLessonSessions, getCurrentLessonByDate, getSortedLessonLogs } from '../domain/lesson/lesson.service';

export default function LessonManagement({ 
    students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog, 
    handleSaveClass, videoProgress, attendanceLogs, calculateClassSessions, logNotification, handleSendStudentNotification, setIsGlobalDirty
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isMobile, setIsMobile] = useState(false);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 선택된 클래스의 일지 목록을 날짜 역순으로 정렬
    const classLogs = useMemo(
        () => getSortedLessonLogs(lessonLogs, selectedClassId),
        [lessonLogs, selectedClassId]
    );

    useEffect(() => {
        if (selectedClassId) {
            if (selectedDate === null && classLogs.length > 0) {
                 setSelectedDate(classLogs[0].date);
            } else if (classLogs.length === 0) {
                 setSelectedDate(null);
            }
        }
    }, [selectedClassId, classLogs.length]); 

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleResize = () => setIsMobile(mediaQuery.matches);
        handleResize();
        mediaQuery.addEventListener('change', handleResize);
        return () => mediaQuery.removeEventListener('change', handleResize);
    }, []);

    const currentLog = useMemo(
        () => getCurrentLessonByDate(classLogs, selectedDate),
        [classLogs, selectedDate]
    );
    
    const handleDateNavigate = (direction) => {
        const sessions = calculateClassSessions(selectedClass);
        const currentIndex = sessions.findIndex(s => s.date === selectedDate);

        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < sessions.length) {
            setSelectedDate(sessions[newIndex].date);
        }
    };
    
    // ✅ [수정] 진도 내용이 포함된 개선된 리스트 (비용 안전)
    const logSessionsContent = useMemo(() => {
        const sessions = calculateClassSessions(selectedClass);
        const sessionItems = buildLessonSessions(sessions, classLogs, selectedDate);
        
        return (
            <ul className="space-y-2 max-h-[500px] overflow-y-auto pr-1 text-sm custom-scrollbar">
                {sessionItems.map(({ session, log, isLogged, isSelected }) => (
                    <li
                        key={session.date}
                        onClick={() => setSelectedDate(session.date)}
                        className={`p-3 rounded-lg transition cursor-pointer border flex flex-col gap-1 ${
                            isSelected
                                ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                : 'bg-white border-transparent hover:bg-gray-50 border-gray-100'
                        }`}
                    >
                        {/* 헤더: 회차 및 날짜 */}
                        <div className="flex justify-between items-center">
                            <span className={`font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                {session.session}회차
                                <span className="font-mono text-xs font-normal ml-2 text-gray-400">{session.date}</span>
                            </span>
                            {isLogged && <Icon name="check" className="w-4 h-4 text-green-500" />}
                        </div>

                        {/* 내용 요약: 진도 내용이 있으면 표시 */}
                        {isLogged ? (
                            <p className="text-xs text-gray-600 line-clamp-2 pl-2 border-l-2 border-indigo-100">
                                {log.progress}
                            </p>
                        ) : (
                            <p className="text-xs text-red-400 pl-2 border-l-2 border-red-100">
                                일지 미작성
                            </p>
                        )}
                    </li>
                ))}
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

    const renderLogDetail = (log) => (
        <>
            <h4 className="text-lg font-bold text-gray-800 border-b pb-2">수업 진도 및 내용</h4>
            <div className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{log.progress}</div>

            {log.materialUrl && (
                <p className="text-sm font-medium text-indigo-600 flex items-center border-t pt-4">
                    <Icon name="fileText" className="w-4 h-4 mr-2" />
                    첨부 자료: <a href={log.materialUrl} target="_blank" rel="noopener noreferrer" className="ml-1 hover:underline">{log.materialUrl}</a>
                </p>
            )}
            
            {log.iframeCode && (
                <div className="border border-gray-300 rounded-lg overflow-hidden mt-4">
                    <div className="aspect-w-16 aspect-h-9" dangerouslySetInnerHTML={{ __html: log.iframeCode }} />
                </div>
            )}

            {log.iframeCode && (
                <VideoProgressViewer 
                    log={log} 
                    students={students} 
                    videoProgress={videoProgress} 
                    attendanceLogs={attendanceLogs} 
                    logNotification={logNotification}
                    handleSendStudentNotification={handleSendStudentNotification}
                />
            )}

            <div className='pt-4 border-t flex justify-end'>
                <button
                    onClick={() => { if(window.confirm('정말 이 수업 일지를 삭제하시겠습니까?')) handleDeleteLessonLog(log.id) }}
                    className='text-sm text-red-500 hover:text-red-700 flex items-center font-medium'
                >
                    <Icon name="trash" className="w-4 h-4 mr-1"/>
                    일지 삭제
                </button>
            </div>
        </>
    );

    const renderLogCards = (containerClass = '') => (
        <div className={`${containerClass} space-y-3`}>
            {classLogs.length === 0 && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-500">작성된 수업 일지가 없습니다. 새로 작성해 주세요.</p>
                </div>
            )}
            {classLogs.map(log => {
                const isOpen = log.date === selectedDate;

                return (
                    <div key={log.id} className="bg-white border border-gray-200 rounded-xl shadow-sm">
                        <button
                            type="button"
                            onClick={() => setSelectedDate(log.date)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-800">{log.date}</p>
                                <p className="text-xs text-gray-500 truncate">{selectedClass?.name}</p>
                            </div>
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${isOpen ? 'bg-indigo-50 text-indigo-900 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                {isOpen ? '선택됨' : '선택'}
                            </span>
                        </button>
                        {isOpen && (
                            <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                                {renderLogDetail(log)}
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleEditLog(log)}
                                        className="flex-1 min-w-[140px] bg-white border border-gray-300 hover:border-indigo-300 text-gray-700 text-sm font-semibold py-2 px-3 rounded-lg flex items-center justify-center shadow-sm"
                                    >
                                        <Icon name="edit" className="w-4 h-4 mr-2 text-gray-500" />
                                        일지 수정
                                    </button>
                                    <button
                                        onClick={() => { if(window.confirm('정말 이 수업 일지를 삭제하시겠습니까?')) handleDeleteLessonLog(log.id) }}
                                        className="flex-1 min-w-[140px] bg-red-50 border border-red-200 text-red-600 text-sm font-semibold py-2 px-3 rounded-lg flex items-center justify-center hover:bg-red-100"
                                    >
                                        <Icon name="trash" className="w-4 h-4 mr-2" />
                                        삭제
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
    
    return (
        <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 h-full items-start"> 
            <div className="w-full xl:w-80 flex-shrink-0">
                <ClassSelectionPanel
                    classes={classes}
                    selectedClassId={selectedClassId}
                    setSelectedClassId={setSelectedClassId}
                    handleClassSave={handleSaveClass}
                    calculateClassSessions={calculateClassSessions}
                    showSessions={!isMobile}
                    selectedDate={selectedDate}
                    handleDateNavigate={handleDateNavigate}
                    showEditButton={true}
                    customPanelContent={logSessionsContent}
                    customPanelTitle="수업 일지 회차"
                    onDateSelect={setSelectedDate} 
                />
            </div>

            <div className="flex-1 min-w-0 w-full space-y-4">
                {selectedClassId === null ? (
                    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                        <p className="text-gray-500">왼쪽에서 클래스를 선택하여 일지를 확인하세요.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* [색상 변경] border-indigo-500 -> border-indigo-900 */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-900">
                            <h3 className="text-xl font-bold text-gray-800 leading-snug">
                                {selectedClass.name} | 
                                {/* [색상 변경] text-indigo-600 -> text-indigo-900 */}
                                <span className="text-indigo-900 ml-2">{selectedDate || '날짜 선택'}</span>
                            </h3>
                            <div className='flex flex-wrap gap-2 justify-start sm:justify-end w-full sm:w-auto'>
                                {isCurrentDateLogged && (
                                    // [색상 변경] 노란색 버튼은 유지하되 톤 다운 고려 (여기서는 가독성을 위해 기존 유지하거나 약간 조정)
                                    // bg-yellow-500 -> bg-white border (Secondary Style)로 변경하여 깔끔하게 처리
                                    <button 
                                        onClick={() => handleEditLog(currentLog)}
                                        className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg flex items-center justify-center shadow-sm transition duration-150 w-full sm:w-auto"
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
                                    } w-full sm:w-auto justify-center`}
                                >
                                    <Icon name="plus" className="w-5 h-5 mr-2" />
                                    {isCurrentDateLogged ? '새로운 일지 작성' : '일지 작성'}
                                </button>
                            </div>
                        </div>

                        {/* 작성된 일지 리스트 */}
                        {renderLogCards('hidden md:block')}
                        {renderLogCards('md:hidden')}

                        {/* 일지 내용 */}
                        {currentLog ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 hidden md:block">
                                {renderLogDetail(currentLog)}
                            </div>
                        ) : (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hidden md:block">
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
                onDirtyChange={setIsGlobalDirty}
            />
        </div>
    );
};