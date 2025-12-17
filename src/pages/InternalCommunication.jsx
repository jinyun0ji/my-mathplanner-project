import React, { useEffect, useState } from 'react';
import Announcement from '../components/Communication/Announcement'; // 경로 수정
import WorkLogs from '../components/Communication/WorkLogs'; // 경로 수정
import Messenger from '../components/Communication/Messenger'; // 경로 수정

export default function InternalCommunication({ 
    announcements, 
    handleSaveAnnouncement, 
    setAnnouncements, 
    students, 
    classes, 
    workLogs, 
    handleSaveWorkLog, 
    handleDeleteWorkLog,
    pendingQuickAction,
    clearPendingQuickAction
}) { 

    const [activeTab, setActiveTab] = useState('announcements');

    useEffect(() => {
        if (pendingQuickAction?.page !== 'communication') return;

        if (pendingQuickAction.tab) {
            setActiveTab(pendingQuickAction.tab);
        }
        clearPendingQuickAction?.();
    }, [pendingQuickAction, clearPendingQuickAction]);
    
    return (
        <div className="space-y-6">
            
            <div className="flex border-b">
                {['announcements', 'worklogs', 'messenger'].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-lg font-medium transition duration-150 ${
                            activeTab === tab ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'
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
                    setAnnouncements={setAnnouncements}
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