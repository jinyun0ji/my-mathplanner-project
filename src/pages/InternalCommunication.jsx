import React, { useState } from 'react';
import Announcement from '../components/Communication/Announcement'; // 경로 수정
import WorkLogs from '../components/Communication/WorkLogs'; // 경로 수정
import Messenger from '../components/Communication/Messenger'; // 경로 수정

export default function InternalCommunication({ announcements, handleSaveAnnouncement, handleDeleteAnnouncement, students, classes, workLogs, handleSaveWorkLog, handleDeleteWorkLog }) { 
       
    const [activeTab, setActiveTab] = useState('announcements');
    
    return (
        <div className="space-y-6">
            
            <div className="flex flex-wrap gap-2 border-b pb-2">
                {['announcements', 'worklogs', 'messenger'].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-base sm:text-lg font-medium rounded-lg transition duration-150 ${
                            activeTab === tab ? 'text-green-600 bg-green-50 border border-green-200' : 'text-gray-500 hover:text-gray-700 bg-white border border-transparent'
                        }`}
                    >
                        {tab === 'announcements' ? '전체 공지사항' : tab === 'worklogs' ? '교직원 근무 일지' : '내부 메신저 (미구현)'}
                    </button>
                ))}
            </div>
            
            {activeTab === 'announcements' && (
                <Announcement 
                    announcements={announcements} 
                    handleSaveAnnouncement={handleSaveAnnouncement} 
                    handleDeleteAnnouncement={handleDeleteAnnouncement}
                    allClasses={classes}
                    allStudents={students}
                />
            )}
            {activeTab === 'worklogs' && (
                <WorkLogs 
                    logs={workLogs} 
                    handleSaveLog={handleSaveWorkLog} 
                    handleDeleteLog={handleDeleteWorkLog}
                />
            )}
            {activeTab === 'messenger' && <Messenger />}
        </div>
    );
};