import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './output.css'; 
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, // ... Firestore Imports (생략)
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// --- 분리된 데이터 & 유틸리티 Import ---
import { 
    initialStudents, initialClasses, initialLessonLogs, initialAttendanceLogs, 
    initialStudentMemos, initialHomeworkAssignments, initialHomeworkResults, 
    initialTests, initialGrades, initialVideoProgress, initialClinicLogs, 
    initialWorkLogs, initialAnnouncements, initialPayments 
} from './api/initialData'; 
import { 
    calculateClassSessions, calculateGradeComparison, 
    calculateHomeworkStats // helpers.js에서 Import
} from './utils/helpers'; 
// Icon, Modal, Modals는 개별 컴포넌트에서 Import하도록 App.jsx에서 제거
// --- 🚨 분리된 레이아웃 Import ---
import LoginPage from './pages/LoginPage';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import NotificationPanel from './layout/NotificationPanel';

// --- 🚨 분리된 페이지 Import ---
import Home from './pages/Home';
import StudentManagement from './pages/StudentManagement';
import StudentDetail from './pages/StudentDetail';
import LessonManagement from './pages/LessonManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import HomeworkManagement from './pages/HomeworkManagement';
import GradeManagement from './pages/GradeManagement';
import ClinicManagement from './pages/ClinicManagement';
import InternalCommunication from './pages/InternalCommunication';
import PaymentManagement from './pages/PaymentManagement';
// (HomeworkManagement, GradeManagement, ClinicManagement, InternalCommunication, PaymentManagement는 하단 PageContent에 정의만 남기고, 별도 파일로 분리해야 합니다.)


// --- Firebase Setup (임시 로직 - 실제 배포 시 Firestore 사용) ---
const firebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : {};
const initialAuthToken = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null; 

let db = null; 
let auth = null; 

try {
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    setLogLevel('error');
} catch (error) {
    console.error("Firebase initialization error. Using local mock data only:", error);
}

// --- 메인 앱 컴포넌트 ---
export default function App() { 
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [page, setPage] = useState('lessons'); 
    const [selectedStudentId, setSelectedStudentId] = useState(null); 
    const [notifications, setNotifications] = useState([]); 
    const [userId, setUserId] = useState(null); 

    // --- 중앙 상태 관리 (유지) ---
    const [students, setStudents] = useState(initialStudents);
    const [classes, setClasses] = useState(initialClasses);
    const [lessonLogs, setLessonLogs] = useState(initialLessonLogs);
    const [attendanceLogs, setAttendanceLogs] = useState(initialAttendanceLogs); 
    const [homeworkAssignments, setHomeworkAssignments] = useState(initialHomeworkAssignments); 
    const [homeworkResults, setHomeworkResults] = useState(initialHomeworkResults); 
    const [tests, setTests] = useState(initialTests);
    const [grades, setGrades] = useState(initialGrades);
    const [studentMemos, setStudentMemos] = useState(initialStudentMemos); 
    const [videoProgress, setVideoProgress] = useState(initialVideoProgress); 
    const [announcements, setAnnouncements] = useState(initialAnnouncements); 
    const [clinicLogs, setClinicLogs] = useState(initialClinicLogs); 
    const [workLogs, setWorkLogs] = useState(initialWorkLogs); 
    
    const nextStudentId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1; 

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [hasNewNotifications, setHasNewNotifications] = useState(true);

    const toggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
        if (!isSidebarOpen) { setHasNewNotifications(false); }
    };

    // --- Auth 및 데이터 로딩 (유지) ---
    useEffect(() => { /* ... Auth 로직 유지 ... */ }, []); 

    // 알림 로깅 함수 (유지)
    const logNotification = useCallback((type, message, details) => {
        setNotifications(prev => [{ id: Date.now(), type, message, details, timestamp: new Date().toLocaleTimeString('ko-KR') }, ...prev]);
    }, []);

    // --- CRUD 함수 (모두 유지) ---
    const handleSaveClass = (classData, isEdit) => { /* ... 유지 ... */ };
    const getClassesNames = useCallback((classIds) => classIds.map(id => classes.find(c => c.id === id)?.name || '').join(', '), [classes]);
    const handleSaveStudent = (newStudentData, isEdit) => { /* ... 유지 ... */ };
    const handleDeleteStudent = (id) => { /* ... 유지 ... */ };
    const handleSaveMemo = (studentId, content) => { /* ... 유지 ... */ };
    const handleSaveLessonLog = (logData, isEdit) => { /* ... 유지 ... */ };
    const handleDeleteLessonLog = (logId) => { /* ... 유지 ... */ }
    const handleSaveAttendance = (attendanceRecords) => { /* ... 유지 ... */ };
    const handleSaveHomeworkAssignment = (assignmentData, isEdit) => { /* ... 유지 ... */ };
    const handleDeleteHomeworkAssignment = (assignmentId) => { /* ... 유지 ... */ };
    const handleUpdateHomeworkResult = (studentId, assignmentId, questionId, status) => { /* ... 유지 ... */ };
    const handleSaveTest = (testData, isEdit) => { /* ... 유지 ... */ };
    const handleDeleteTest = (testId) => { /* ... 유지 ... */ };
    const handleUpdateGrade = (studentId, testId, resultMapping) => { /* ... 유지 ... */ };
    const handleSaveAnnouncement = (announcementData, isEdit) => { /* ... 유지 ... */ };
    const handleSaveWorkLog = (logData, isEdit) => { /* ... 유지 ... */ };
    const handleDeleteWorkLog = (id) => { /* ... 유지 ... */ };
    const handleSaveClinicLog = (logData, isEdit) => { /* ... 유지 ... */ };
    const handleDeleteClinicLog = (id) => { /* ... 유지 ... */ };
    
    if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;

    const handlePageChange = (newPage, studentId = null) => {
        if (newPage === 'students' && studentId === null) {
            setSelectedStudentId(null); 
        } else {
            setSelectedStudentId(studentId);
        }
        setPage(newPage);
    }
    
    const managementProps = {
        students, classes, lessonLogs, attendanceLogs, workLogs, clinicLogs, 
        homeworkAssignments, homeworkResults, tests, grades, studentMemos, videoProgress, announcements, 
        setAnnouncements, nextStudentId, // nextStudentId 추가
        getClassesNames,
        handleSaveStudent, handleDeleteStudent,
        handleSaveClass, 
        handleSaveLessonLog, handleDeleteLessonLog,
        handleSaveAttendance,
        handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult,
        handleSaveTest, handleDeleteTest, handleUpdateGrade,
        handleSaveMemo, 
        handleSaveAnnouncement, handleSaveWorkLog, handleDeleteWorkLog, 
        handleSaveClinicLog, handleDeleteClinicLog, 
        calculateClassSessions,
        selectedStudentId,
        handlePageChange, 
        logNotification, 
        notifications, 
        // 유틸리티 함수도 props로 전달
        calculateGradeComparison,
        calculateHomeworkStats
    };

    // --- PageContent 컴포넌트: 페이지 라우팅 로직만 포함 ---
    const PageContent = (props) => {
        const { page, selectedStudentId } = props;

        if (page === 'students' && selectedStudentId !== null) {
            return <StudentDetail {...props} studentId={selectedStudentId} />;
        }

        switch (page) {
            case 'home':
                return <Home />;
            case 'lessons':
                return <LessonManagement {...props} />;
            case 'attendance':
                return <AttendanceManagement {...props} />;
            case 'students':
                return <StudentManagement {...props} />;
            case 'grades':
                return <GradeManagement {...props} />;
            case 'homework':
                return <HomeworkManagement {...props} />;
            case 'clinic':
                return <ClinicManagement {...props} />;
            case 'communication':
                return <InternalCommunication {...props} />;
            case 'payment':
                return <PaymentManagement {...props} />;
            default:
                return <Home />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 font-sans text-base relative"> 
            <Sidebar page={page} setPage={(newPage) => handlePageChange(newPage, null)} onLogout={() => setIsLoggedIn(false)} />
            
            <div 
                className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ease-in-out 
                            ${isSidebarOpen ? 'mr-80' : 'mr-0'}`} 
            >
                <Header page={page} />
                <main id="main-content" className="overflow-x-hidden overflow-y-auto bg-gray-100 p-6 min-w-0">
                    <PageContent page={page} {...managementProps} />
                </main>
            </div>

            <NotificationPanel 
                notifications={notifications} 
                isSidebarOpen={isSidebarOpen} 
                toggleSidebar={toggleSidebar} 
                hasNewNotifications={hasNewNotifications} 
                setHasNewNotifications={setHasNewNotifications}
            />
        </div>
    );
}

// 기존에 App.jsx에 있던 모든 하위 컴포넌트 정의는 삭제됨.
// 예를 들어, LessonManagement, StudentManagement 등은 모두 별도 파일로 이동함.