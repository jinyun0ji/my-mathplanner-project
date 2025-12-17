import React, { useState, useEffect } from 'react';
import HomeworkTab from './HomeworkTab';
import GradesTab from './GradesTab';
import ClinicTab from './ClinicTab';

export default function LearningTab({ studentId, myHomeworkStats, myGradeComparison, clinicLogs, students, classes, initialTab = 'homework', isParent = false }) {
    const [subTab, setSubTab] = useState(initialTab); 
    
    useEffect(() => {
        setSubTab(initialTab);
    }, [initialTab]);

    return (
        <div className="animate-fade-in-up h-full flex flex-col pb-24">
            <h2 className="text-2xl font-bold text-gray-900 px-1 mb-4">학습 관리</h2>
            <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
                <button onClick={() => setSubTab('homework')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${subTab === 'homework' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>과제</button>
                <button onClick={() => setSubTab('grades')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${subTab === 'grades' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>성적</button>
                <button onClick={() => setSubTab('clinic')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${subTab === 'clinic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>클리닉</button>
            </div>
            <div className="flex-1">
                {subTab === 'homework' && <HomeworkTab myHomeworkStats={myHomeworkStats} />}
                {subTab === 'grades' && <GradesTab myGradeComparison={myGradeComparison} />}
                {subTab === 'clinic' && <ClinicTab studentId={studentId} clinicLogs={clinicLogs} students={students} classes={classes} isParent={isParent} />}
            </div>
        </div>
    );
};