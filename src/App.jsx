import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './output.css'; // Tailwind CSS 파일
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, 
    onSnapshot, collection, query, where, getDocs, initializeFirestore,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// --- 분리된 데이터 및 유틸리티 Import ---
import { 
    initialStudents, initialClasses, initialLessonLogs, initialAttendanceLogs, 
    initialStudentMemos, initialHomeworkAssignments, initialHomeworkResults, 
    initialTests, initialGrades, initialVideoProgress, initialClinicLogs, 
    initialWorkLogs, initialAnnouncements, initialPayments 
} from './api/initialData'; 
import { 
    calculateClassSessions, calculateGradeComparison, 
    calculateHomeworkStats 
} from './utils/helpers'; 

// --- 🚨 분리된 레이아웃 및 페이지 컴포넌트 Import ---
import LoginPage from './pages/LoginPage';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import NotificationPanel from './layout/NotificationPanel';
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

// --- 메인 앱 컴포넌트: 모든 상태와 CRUD 로직을 관리하는 중앙 허브 ---
export default function App() { 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState('lessons'); 
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  const [notifications, setNotifications] = useState([]); 
  const [userId, setUserId] = useState(null); 

  // --- 중앙 상태 관리 (임시 데이터) ---
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

  // 사이드바 열림/닫힘 상태 관리
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   
  // 새로운 알림 존재 여부
  const [hasNewNotifications, setHasNewNotifications] = useState(true);

  // 사이드바 열림/닫힘 토글 함수
  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
    if (!isSidebarOpen) { setHasNewNotifications(false); }
  };

  // --- Auth 및 데이터 로딩 ---
  useEffect(() => {
    if (auth) {
        const handleAuth = async () => {
            try {
                if (initialAuthToken) { 
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (e) {
                console.error("Firebase Auth sign-in failed:", e);
            }
        };
        handleAuth();

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                setIsLoggedIn(true); 
            } else {
                setUserId(null);
                setIsLoggedIn(true); 
            }
        });

        return () => unsubscribe();
    } else {
        setIsLoggedIn(true);
        setUserId('mock-user');
        console.log("Using mock user and mock data.");
    }
  }, []); 

  // 알림 로깅 함수
    const logNotification = useCallback((type, message, details) => {
        setNotifications(prev => [{ id: Date.now(), type, message, details, timestamp: new Date().toLocaleTimeString('ko-KR') }, ...prev]);
    }, []);

  // --- CRUD 함수: 클래스 관리 ---
  const handleSaveClass = (classData, isEdit) => {
    setClasses(prev => {
        if (isEdit) {
            return prev.map(c => c.id === classData.id ? { ...c, ...classData } : c);
        }
        const newClass = { ...classData, id: prev.reduce((max, c) => Math.max(max, c.id), 0) + 1, students: [] };
        logNotification('success', '클래스 등록 성공', `${newClass.name} 클래스가 새로 등록되었습니다.`);
        return [...prev, newClass];
    });
  };


  // --- CRUD 함수: 학생 관리 ---
  const getClassesNames = useCallback((classIds) => classIds.map(id => classes.find(c => c.id === id)?.name || '').join(', '), [classes]);
  
  const handleSaveStudent = (newStudentData, isEdit) => {
    setStudents(prev => {
        if (isEdit) {
            logNotification('success', '학생 정보 수정 완료', `${newStudentData.name} 학생 정보가 업데이트되었습니다.`);
            return prev.map(s => s.id === newStudentData.id ? { ...s, ...newStudentData } : s);
        }
        const newStudent = { ...newStudentData, id: nextStudentId, registeredDate: new Date().toISOString().slice(0, 10), books: [] };
        logNotification('success', '학생 등록 완료', `${newStudent.name} 학생이 새로 등록되었습니다.`);
        return [...prev, newStudent];
    });

    // 클래스 멤버십 업데이트 (추가/제거)
    setClasses(prev => prev.map(cls => {
        const isSelected = newStudentData.classes.includes(cls.id);
        const isMember = cls.students.includes(newStudentData.id);

        if (isSelected && !isMember) {
            // 클래스에 추가
            return { ...cls, students: [...cls.students, newStudentData.id] };
        } else if (!isSelected && isMember) {
            // 클래스에서 제거
            return { ...cls, students: cls.students.filter(id => id !== newStudentData.id) };
        }
        return cls;
    }));
  };

  const handleDeleteStudent = (id) => {
    const studentName = students.find(s => s.id === id)?.name;
    setStudents(prev => prev.filter(s => s.id !== id));
    logNotification('warning', '학생 삭제 처리', `${studentName} 학생 정보가 시스템에서 삭제되었습니다.`);

    // 클래스에서 학생 제거
    setClasses(prev => prev.map(cls => ({
        ...cls,
        students: cls.students.filter(sId => sId !== id)
    })));
  };
  
  // --- CRUD 함수: 메모 관리 ---
  const handleSaveMemo = (studentId, content) => {
    setStudentMemos(prev => ({
        ...prev,
        [studentId]: content
    }));
    logNotification('info', '학생 메모 저장', `${students.find(s => s.id === studentId)?.name} 학생 메모가 저장되었습니다.`);
  };

  // --- CRUD 함수: 수업 일지 관리 ---
  const handleSaveLessonLog = (logData, isEdit) => {
    setLessonLogs(prev => {
        if (isEdit) {
            logNotification('success', '수업 일지 수정 완료', `일지(ID:${logData.id})가 수정되었습니다.`);
            return prev.map(log => log.id === logData.id ? { ...log, ...logData } : log);
        }
        const newLog = { ...logData, id: prev.reduce((max, log) => Math.max(max, log.id), 0) + 1 };
        logNotification('success', '수업 일지 등록 완료', `${classes.find(c => c.id === logData.classId)?.name}의 새 일지가 등록되었습니다.`);
        return [...prev, newLog];
    });
  };

  const handleDeleteLessonLog = (logId) => {
    setLessonLogs(prev => prev.filter(log => log.id !== logId));
    logNotification('warning', '수업 일지 삭제', `일지(ID:${logId})가 삭제되었습니다.`);
  }
  
  // --- CRUD 함수: 출석 관리 (버그 수정 반영) ---
  const handleSaveAttendance = (attendanceRecords) => {
    setAttendanceLogs(prev => {
        const newLogs = [...prev];
        attendanceRecords.forEach(record => {
            const existingIndex = newLogs.findIndex(
                log => log.classId === record.classId && log.date === record.date && log.studentId === record.studentId
            );

            if (existingIndex > -1) {
                newLogs[existingIndex] = record;
            } else {
                newLogs.push({ 
                    ...record, 
                    // ✅ 버그 수정: ID가 없는 경우를 안전하게 처리하여 다음 ID를 생성합니다.
                    id: newLogs.reduce((max, l) => Math.max(max, l.id || 0), 0) + 1 
                });
            }
        });
        return newLogs;
    });
    logNotification('success', '출결 기록 저장', `총 ${attendanceRecords.length}건의 출결 기록이 업데이트되었습니다.`);
  };

  // --- CRUD 함수: 과제 관리 ---
  const handleSaveHomeworkAssignment = (assignmentData, isEdit) => {
    setHomeworkAssignments(prev => {
        if (isEdit) {
            logNotification('success', '과제 수정 완료', `과제(ID:${assignmentData.id})가 수정되었습니다.`);
            return prev.map(a => a.id === assignmentData.id ? { ...a, ...assignmentData } : a);
        }
        const newId = prev.reduce((max, a) => Math.max(max, a.id), 0) + 1;
        const newAssignment = { ...assignmentData, id: newId };
        logNotification('success', '과제 배정 완료', `새로운 과제(ID:${newId})가 배정되었습니다.`);
        return [...prev, newAssignment];
    });
  };

  const handleDeleteHomeworkAssignment = (assignmentId) => {
    setHomeworkAssignments(prev => prev.filter(a => a.id !== assignmentId));
    logNotification('warning', '과제 삭제', `과제(ID:${assignmentId})가 삭제되었습니다.`);
  };
  
  // 과제 결과 상세 기록 (문항별 상태 맵)
  const handleUpdateHomeworkResult = (studentId, assignmentId, questionId, status) => {
    setHomeworkResults(prev => {
        const newResults = { ...prev };
        const sId = studentId;
        const aId = assignmentId;

        if (!newResults[sId]) newResults[sId] = {};
        if (!newResults[sId][aId]) newResults[sId][aId] = {};

        if (status) {
            newResults[sId][aId][questionId] = status;
        } else {
            delete newResults[sId][aId][questionId];
        }

        if (Object.keys(newResults[sId][aId]).length === 0) {
            delete newResults[sId][aId];
        }
        
        return newResults;
    });
  };

  // --- CRUD 함수: 성적 및 테스트 관리 ---
  const handleSaveTest = (testData, isEdit) => {
    setTests(prev => {
        if (isEdit) {
            logNotification('success', '시험 정보 수정 완료', `${testData.name} 시험 정보가 업데이트되었습니다.`);
            return prev.map(t => t.id === testData.id ? { ...t, ...testData } : t);
        }
        const newTest = { ...testData, id: prev.reduce((max, t) => Math.max(max, t.id), 0) + 1 };
        logNotification('success', '시험 등록 완료', `${newTest.name} 시험이 새로 등록되었습니다.`);
        return [...prev, newTest];
    });
  };

  const handleDeleteTest = (testId) => {
    setTests(prev => prev.filter(t => t.id !== testId));
    
    // 관련 성적 데이터 삭제 (grades)
    setGrades(prev => {
        const newGrades = {};
        for (const studentId in prev) {
            const studentGrades = { ...prev[studentId] };
            delete studentGrades[testId];
            newGrades[studentId] = studentGrades;
        }
        return newGrades;
    });
    logNotification('warning', '시험 삭제', `시험(ID:${testId})이 삭제되고 관련 성적도 초기화되었습니다.`);
  };

  // 🚨 FIX: 성적 반영 로직 확인 및 코멘트 저장
  const handleUpdateGrade = (studentId, testId, resultMapping, comment = '') => { 
    const test = tests.find(t => t.id === testId);
    if (!test) return;

    let totalScore = 0;
    
    if (resultMapping === '미응시') {
        totalScore = null; 
    } else if (resultMapping) {
        // 문항별 점수 계산
        Object.keys(resultMapping).forEach(qNum => {
            const status = resultMapping[qNum];
            const qIndex = Number(qNum) - 1;
            const score = test.questionScores[qIndex] || 0; 

            // '맞음' 또는 '고침' 상태는 점수 획득
            if (status === '맞음' || status === '고침') { 
                totalScore += score;
            }
        });
    }

    setGrades(prev => ({
        ...prev,
        [studentId]: {
            ...prev[studentId],
            [testId]: { 
                score: totalScore, 
                correctCount: resultMapping, // 문항별 결과 저장 (통계 반영에 사용)
                comment: comment // 🚨 코멘트 저장
            }
        }
    }));
    
    const student = students.find(s => s.id === studentId);
    const scoreText = totalScore === null ? '미응시 처리' : `${totalScore.toFixed(1)}점 저장`;
    logNotification('info', '성적 저장', `${student ? student.name : '학생'}의 성적(${test.name})이 ${scoreText}되었습니다.`);
  };
  
  // --- CRUD 함수: 공지사항 관리 ---
  const handleSaveAnnouncement = (announcementData, isEdit) => {
    setAnnouncements(prev => {
        if (isEdit) {
            logNotification('success', '공지사항 수정 완료', `${announcementData.title}이(가) 수정되었습니다.`);
            return prev.map(a => a.id === announcementData.id ? { ...a, ...announcementData } : a);
        }
        const newAnnouncement = { 
            ...announcementData, 
            id: prev.reduce((max, a) => Math.max(max, a.id), 0) + 1,
            author: '관리자',
            date: new Date().toISOString().slice(0, 10),
        };
        logNotification('success', '공지사항 등록/예약', `${newAnnouncement.title} 공지사항이 ${newAnnouncement.scheduleTime ? '예약' : '즉시'} 등록되었습니다.`);
        return [...prev, newAnnouncement];
    });
  }

  // --- CRUD 함수: 근무 일지 관리 ---
  const handleSaveWorkLog = (logData, isEdit) => {
    setWorkLogs(prev => {
        if (isEdit) {
            logNotification('success', '근무 일지 수정 완료', `일지(ID:${logData.id})가 수정되었습니다.`);
            return prev.map(log => log.id === logData.id ? { ...log, ...logData } : log);
        }
        const newLog = { 
            ...logData, 
            id: prev.reduce((max, l) => Math.max(max, l.id), 0) + 1,
            author: '채수용', 
            date: new Date().toISOString().slice(0, 10),
        };
        logNotification('success', '근무 일지 등록 완료', `새로운 근무 일지(ID:${newLog.id})가 등록되었습니다.`);
        return [...prev, newLog];
    });
  };
  const handleDeleteWorkLog = (id) => {
    setWorkLogs(prev => prev.filter(log => log.id !== id));
    logNotification('warning', '근무 일지 삭제', `일지(ID:${id})가 삭제되었습니다.`);
  };


  // --- CRUD 함수: 클리닉 로그 관리 ---
  const handleSaveClinicLog = (logData, isEdit) => {
    setClinicLogs(prev => {
        if (isEdit) {
            logNotification('success', '클리닉 로그 수정 완료', `로그(ID:${logData.id})가 수정되었습니다.`);
            return prev.map(log => log.id === logData.id ? { ...log, ...logData } : log);
        }
        const newLog = { ...logData, id: prev.reduce((max, l) => Math.max(max, l.id), 0) + 1 };
        logNotification('success', '클리닉 로그 등록 완료', `${newLog.studentName} 학생의 클리닉 로그가 등록되었습니다.`);
        return [...prev, newLog];
    });
  };
  const handleDeleteClinicLog = (id) => {
    setClinicLogs(prev => prev.filter(log => log.id !== id));
    logNotification('warning', '클리닉 로그 삭제', `로그(ID:${id})가 삭제되었습니다.`);
  };
  

  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;

  // 페이지 전환 로직 업데이트 (학생 관리 메뉴 클릭 시, selectedStudentId 초기화)
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
    setAnnouncements, 
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
    calculateGradeComparison,
    calculateHomeworkStats
  };

  // --- PageContent 컴포넌트: 페이지 라우팅 로직만 포함 ---
  const PageContent = (props) => {
    const { page, selectedStudentId } = props;

    // 학생 상세 페이지
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
    
    {/* Sidebar (왼쪽 메뉴) */}
    <Sidebar page={page} setPage={(newPage) => handlePageChange(newPage, null)} onLogout={() => setIsLoggedIn(false)} />
    
    {/* 메인 컨텐츠 영역: 알림 패널 상태에 따라 오른쪽 마진(mr) 조정 */}
    <div 
      className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ease-in-out 
                  ${isSidebarOpen ? 'mr-80' : 'mr-0'}`} 
    >
      <Header page={page} />
      <main id="main-content" className="overflow-x-hidden overflow-y-auto bg-gray-100 p-6 min-w-0">
        <PageContent page={page} {...managementProps} />
      </main>
    </div>

    {/* 오른쪽 알림 패널 (Notification Panel) */}
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