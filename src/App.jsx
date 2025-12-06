import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, 
    onSnapshot, collection, query, where, getDocs, initializeFirestore,
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
    Icon, calculateClassSessions, calculateGradeComparison, 
    calculateHomeworkStats 
} from './utils/helpers'; 
import { Modal } from './components/common/Modal'; 

// --- 🚨 모달 컴포넌트 Import ---
import { StudentFormModal } from './utils/modals/StudentFormModal';
import { ClassFormModal } from './utils/modals/ClassFormModal';
import { LessonLogFormModal } from './utils/modals/LessonLogFormModal';
import { HomeworkAssignmentModal } from './utils/modals/HomeworkAssignmentModal';
import { TestFormModal } from './utils/modals/TestFormModal';
import { ClinicLogModal } from './utils/modals/ClinicLogModal';
import { AnnouncementModal } from './utils/modals/AnnouncementModal';
import { MemoModal } from './utils/modals/MemoModal';
import { AttendanceModal } from './components/common/AttendanceModal'; 


// --- Firebase Setup (임시 로직 - 실제 배포 시 Firestore 사용) ---
const firebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : {};
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
const initialAuthToken = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null; 

let db = null; // 초기값 명시
let auth = null; // 초기값 명시
let firebaseApp;

try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    setLogLevel('error');
} catch (error) {
    // 초기화 오류 발생 시 auth와 db는 null 상태를 유지합니다.
    console.error("Firebase initialization error. Using local mock data only:", error);
}

// --- 메인 앱 컴포넌트: 모든 상태와 CRUD 로직을 관리하는 중앙 허브 ---
export default function App() { 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState('lessons'); 
  const [selectedStudentId, setSelectedStudentId] = useState(null); 
  const [notifications, setNotifications] = useState([]); 
  const [userId, setUserId] = useState(null); // Firestore userId

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

  // --- Auth 및 데이터 로딩 ---
  useEffect(() => {
    // 🚨 auth 객체가 유효한 경우에만 인증 로직 실행
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
                // 인증 실패 시 로그아웃 상태 유지
            }
        };
        handleAuth();

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                setIsLoggedIn(true); // 로그인 상태 설정
            } else {
                setUserId(null);
                // Firebase 초기화는 성공했으나 인증이 안된 경우,
                // 내부 Mock 데이터로 실행하기 위해 isLoggedIn을 true로 강제 설정합니다.
                // 실제 배포 시에는 로그인 페이지로 리디렉션해야 합니다.
                setIsLoggedIn(true); 
            }
        });

        return () => unsubscribe();
    } else {
        // Firebase 초기화에 실패한 경우, Mock 데이터로 즉시 시작
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
    // ... (기존 handleSaveClass 내용 유지)
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
    // ... (기존 handleSaveStudent 내용 유지)
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
    // ... (기존 handleDeleteStudent 내용 유지)
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
    // ... (기존 handleSaveMemo 내용 유지)
    setStudentMemos(prev => ({
        ...prev,
        [studentId]: content
    }));
    logNotification('info', '학생 메모 저장', `${students.find(s => s.id === studentId)?.name} 학생 메모가 저장되었습니다.`);
  };

  // --- CRUD 함수: 수업 일지 관리 ---
  const handleSaveLessonLog = (logData, isEdit) => {
    // ... (기존 handleSaveLessonLog 내용 유지)
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
    // ... (기존 handleDeleteLessonLog 내용 유지)
    setLessonLogs(prev => prev.filter(log => log.id !== logId));
    logNotification('warning', '수업 일지 삭제', `일지(ID:${logId})가 삭제되었습니다.`);
  }
  
  // --- CRUD 함수: 출석 관리 ---
  const handleSaveAttendance = (attendanceRecords) => {
    // ... (기존 handleSaveAttendance 내용 유지)
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
                    id: newLogs.reduce((max, l) => Math.max(max, l.id), 0) + 1 
                });
            }
        });
        return newLogs;
    });
    logNotification('success', '출결 기록 저장', `총 ${attendanceRecords.length}건의 출결 기록이 업데이트되었습니다.`);
  };

  // --- CRUD 함수: 과제 관리 ---
  const handleSaveHomeworkAssignment = (assignmentData, isEdit) => {
    // ... (기존 handleSaveHomeworkAssignment 내용 유지)
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
    // ... (기존 handleDeleteHomeworkAssignment 내용 유지)
    setHomeworkAssignments(prev => prev.filter(a => a.id !== assignmentId));
    logNotification('warning', '과제 삭제', `과제(ID:${assignmentId})가 삭제되었습니다.`);
  };
  
  // 과제 결과 상세 기록 (문항별 상태 맵)
  const handleUpdateHomeworkResult = (studentId, assignmentId, questionId, status) => {
    // ... (기존 handleUpdateHomeworkResult 내용 유지)
    setHomeworkResults(prev => {
        const newResults = { ...prev };
        const sId = studentId;
        const aId = assignmentId;

        // 학생 ID가 없으면 초기화
        if (!newResults[sId]) newResults[sId] = {};
        
        // 과제 ID가 없으면 초기화
        if (!newResults[sId][aId]) newResults[sId][aId] = {};

        // 문항 상태 업데이트
        if (status) {
            newResults[sId][aId][questionId] = status;
        } else {
            delete newResults[sId][aId][questionId];
        }

        // 문항별 결과가 비어있으면 과제 ID도 삭제 (선택 사항)
        if (Object.keys(newResults[sId][aId]).length === 0) {
            delete newResults[sId][aId];
        }
        
        return newResults;
    });
  };

  // --- CRUD 함수: 성적 및 테스트 관리 ---
  const handleSaveTest = (testData, isEdit) => {
    // ... (기존 handleSaveTest 내용 유지)
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
    // ... (기존 handleDeleteTest 내용 유지)
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

  // 🚨 handleUpdateGrade 함수: 문항별 결과 맵을 받아서 총점 계산
  const handleUpdateGrade = (studentId, testId, resultMapping) => { 
    // ... (기존 handleUpdateGrade 내용 유지)
    const test = tests.find(t => t.id === testId);
    if (!test) return;

    let totalScore = 0;
    
    if (resultMapping === '미응시') {
        totalScore = null; // null은 미응시를 의미
    } else if (resultMapping) {
        // 문항별 점수 계산
        Object.keys(resultMapping).forEach(qNum => {
            const status = resultMapping[qNum];
            const qIndex = Number(qNum) - 1;
            const score = test.questionScores[qIndex] || 0; // 해당 문항 배점

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
                correctCount: resultMapping // 문항별 결과 저장
            }
        }
    }));
    
    const scoreText = totalScore === null ? '미응시 처리' : `${totalScore.toFixed(1)}점 저장`;
    logNotification('info', '성적 저장', `${students.find(s => s.id === studentId)?.name} 학생의 성적(${test.name})이 ${scoreText}되었습니다.`);
  };
  
  // --- CRUD 함수: 공지사항 관리 ---
  const handleSaveAnnouncement = (announcementData, isEdit) => {
    // ... (기존 handleSaveAnnouncement 내용 유지)
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
    // ... (기존 handleSaveWorkLog 내용 유지)
    setWorkLogs(prev => {
        if (isEdit) {
            logNotification('success', '근무 일지 수정 완료', `일지(ID:${logData.id})가 수정되었습니다.`);
            return prev.map(log => log.id === logData.id ? { ...log, ...logData } : log);
        }
        const newLog = { 
            ...logData, 
            id: prev.reduce((max, l) => Math.max(max, l.id), 0) + 1,
            author: '채수용', // 임시 작성자
            date: new Date().toISOString().slice(0, 10),
        };
        logNotification('success', '근무 일지 등록 완료', `새로운 근무 일지(ID:${newLog.id})가 등록되었습니다.`);
        return [...prev, newLog];
    });
  };
  const handleDeleteWorkLog = (id) => {
    // ... (기존 handleDeleteWorkLog 내용 유지)
    setWorkLogs(prev => prev.filter(log => log.id !== id));
    logNotification('warning', '근무 일지 삭제', `일지(ID:${id})가 삭제되었습니다.`);
  };


  // --- CRUD 함수: 클리닉 로그 관리 ---
  const handleSaveClinicLog = (logData, isEdit) => {
    // ... (기존 handleSaveClinicLog 내용 유지)
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
    // ... (기존 handleDeleteClinicLog 내용 유지)
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
    // calculateClassSessions는 utils에서 import
    calculateClassSessions,
    selectedStudentId,
    handlePageChange, 
    logNotification, 
    notifications, 
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-base"> 
      {/* Sidebar, Header, NotificationPanel, PageContent 등은 App.jsx에 임시로 남겨둠 */}
      <Sidebar page={page} setPage={(newPage) => handlePageChange(newPage, null)} onLogout={() => setIsLoggedIn(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header page={page} />
        <main id="main-content" className="overflow-x-hidden overflow-y-auto bg-gray-100 p-6 min-w-0">
          <PageContent page={page} {...managementProps} />
        </main>
      </div>
      <NotificationPanel notifications={notifications} />
    </div>
  );
}

// --- Notification Panel Component (유지) ---
const NotificationPanel = ({ notifications }) => {
    // ... (기존 NotificationPanel 내용 유지)
    return (
        <div className="w-64 bg-white border-l shadow-lg overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b">
                <h3 className="text-lg font-bold flex items-center text-gray-800">
                    <Icon name="bell" className="w-5 h-5 mr-2 text-yellow-600"/>
                    알림
                </h3>
            </div>
            <div className="space-y-3 p-4">
                {notifications.length === 0 ? (
                    <p className="text-sm text-gray-500">새로운 알림이 없습니다.</p>
                ) : (
                    notifications.slice(0, 10).map((n, index) => (
                        <div key={n.id} className={`p-3 rounded-lg border text-sm ${
                            n.type === 'success' ? 'bg-green-50 border-green-200' :
                            n.type === 'warning' ? 'bg-red-50 border-red-200' :
                            n.type === 'scheduled' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-blue-50 border-blue-200'
                        }`}>
                            <p className="font-semibold">{n.message}</p>
                            <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{n.details}</p>
                            <p className="text-xs text-right text-gray-400 mt-1">{n.timestamp}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
// --- 레이아웃 및 페이지 컴포넌트 ---
const LoginPage = ({ onLogin }) => { 
    // ... (기존 LoginPage 내용 유지)
    const [id, setId] = useState('employee');
    const [password, setPassword] = useState('academy');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        if (id === 'employee' && password === 'academy') {
            onLogin();
        } else {
            setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="w-full max-w-md">
                <form onSubmit={handleLogin} className="bg-white shadow-2xl rounded-xl px-8 pt-6 pb-8 mb-4">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-extrabold text-blue-600 flex items-center justify-center">
                            <Icon name="graduationCap" className="w-8 h-8 mr-2" />
                            학원 관리 시스템
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">직원 로그인 페이지</p>
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                            아이디 (employee)
                        </label>
                        <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-blue-500 focus:border-blue-500" 
                                id="username" type="text" placeholder="아이디" value={id} onChange={(e) => setId(e.target.value)} />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                            비밀번호 (academy)
                        </label>
                        <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:ring-blue-500 focus:border-blue-500" 
                                id="password" type="password" placeholder="******************" value={password} onChange={(e) => setPassword(e.target.value)} />
                        {error && <p className="text-red-500 text-xs italic">{error}</p>}
                    </div>
                    <div className="flex items-center justify-between">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-150 w-full shadow-md" type="submit">
                            로그인
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Sidebar = ({ page, setPage, onLogout }) => {
    // ... (기존 Sidebar 내용 유지)
    const menuItems = [
        { name: '홈', key: 'home', icon: 'dashboard' },
        { name: '수업 관리', key: 'lessons', icon: 'fileText' },
        { name: '출결 관리', key: 'attendance', icon: 'calendar' },
        { name: '학생 관리', key: 'students', icon: 'users' },
        { name: '성적 관리', key: 'grades', icon: 'barChart' },
        { name: '과제 관리', key: 'homework', icon: 'clipboardCheck' },
        { name: '클리닉 관리', key: 'clinic', icon: 'clock' },
        { name: '내부 소통', key: 'communication', icon: 'messageSquare' },
        { name: '교재/수납', key: 'payment', icon: 'wallet' },
    ];
    
    return (
        <div className="w-56 bg-white shadow-2xl flex flex-col justify-between flex-shrink-0">
            <div>
                <div className="p-5 border-b-2 border-indigo-500 bg-indigo-600 text-white rounded-tr-xl">
                    <h2 className="text-xl font-bold flex items-center">
                        <Icon name="school" className="w-6 h-6 mr-2" />
                        <span className="text-yellow-300">A</span>cademy
                    </h2>
                    <p className="text-xs mt-1 text-indigo-200">직원 시스템</p>
                </div>
                <nav className="mt-4 space-y-2 px-3">
                    {menuItems.map(item => (
                        <button
                            key={item.key}
                            onClick={() => setPage(item.key)}
                            className={`flex items-center w-full px-4 py-2.5 rounded-xl transition duration-150 text-sm font-medium ${
                                page === item.key 
                                    ? 'bg-indigo-500 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-indigo-100 hover:text-indigo-600'
                            }`}
                        >
                            <Icon name={item.icon} className="w-5 h-5 mr-3" />
                            {item.name}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="p-4 border-t">
                <button 
                    onClick={onLogout}
                    className="flex items-center w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 transition duration-150"
                >
                    <Icon name="logOut" className="w-5 h-5 mr-3" />
                    로그아웃
                </button>
            </div>
        </div>
    );
};

const Header = ({ page }) => {
    // ... (기존 Header 내용 유지)
    const pageTitleMap = {
        home: '시스템 대시보드',
        lessons: '수업 일지 및 진도 관리',
        attendance: '학생 출결 기록',
        students: '학생/학부모 정보 관리',
        grades: '시험 및 성적 관리',
        homework: '과제 배정 및 결과 관리',
        clinic: '클리닉 활동 로그',
        communication: '내부 소통 및 공지',
        payment: '교재 및 수납 현황',
    };
    
    return (
        <header className="bg-white shadow-sm flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold text-gray-800">{pageTitleMap[page] || '관리 시스템'}</h1>
            <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-600">채수용 선생님</span>
            </div>
        </header>
    );
};

const PageContent = (props) => {
    // ... (기존 PageContent 내용 유지)
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

// --- 각 페이지 컴포넌트 (App.jsx에 임시로 남겨둠 - 다음 단계에서 분리 예정) ---
const Home = () => <div className="p-6 bg-white rounded-lg shadow-md text-sm"><h3 className="text-xl font-semibold">홈</h3><p>학원 운영의 전반적인 현황을 한눈에 볼 수 있는 주요 정보를 요약하여 제공합니다.</p></div>; 

const StudentManagement = ({ students, classes, getClassesNames, handleSaveStudent, handleDeleteStudent, attendanceLogs, studentMemos, handleSaveMemo, handlePageChange }) => {
    // ... (기존 StudentManagement 내용 유지)
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [search, setSearch] = useState('');
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });

    const filteredStudents = useMemo(() => {
        return students.filter(student =>
            student.name.includes(search) || 
            student.school.includes(search) ||
            student.phone.includes(search)
        ).sort((a, b) => {
            if (a.status === '재원생' && b.status !== '재원생') return -1;
            if (a.status !== '재원생' && b.status === '재원생') return 1;
            return b.registeredDate.localeCompare(a.registeredDate);
        });
    }, [students, search]);

    const handleEdit = (student) => {
        setStudentToEdit(student);
        setIsStudentModalOpen(true);
    };

    const handleNewStudent = () => {
        setStudentToEdit(null);
        setIsStudentModalOpen(true);
    };

    const openMemoModal = (student) => {
        setMemoModalState({
            isOpen: true,
            studentId: student.id,
            content: studentMemos[student.id] || '',
            studentName: student.name,
        });
    };

    const closeMemoModal = () => {
        setMemoModalState({ isOpen: false, studentId: null, content: '', studentName: '' });
    };

    // 출석 요약 (가장 최근 10회 수업 기준)
    const getAttendanceSummary = useCallback((studentId) => {
        const studentLogs = attendanceLogs.filter(log => log.studentId === studentId);
        const lastTen = studentLogs.slice(-10); 
        
        const summary = {
            '출석': 0, '지각': 0, '결석': 0, '동영상보강': 0, total: lastTen.length
        };
        lastTen.forEach(log => {
            if (summary[log.status] !== undefined) {
                summary[log.status]++;
            }
        });
        return summary;
    }, [attendanceLogs]);


    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800">학생 정보 관리</h3>
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex space-x-3 items-center w-1/3">
                        <Icon name="search" className="w-5 h-5 text-gray-500"/>
                        <input
                            type="text"
                            placeholder="이름, 학교, 연락처로 검색..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg w-full focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <button 
                        onClick={handleNewStudent}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                    >
                        <Icon name="plus" className="w-5 h-5 mr-2" />
                        새 학생 등록
                    </button>
                </div>
                
                <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['이름', '학교', '학년', '상태', '수강 클래스', '최근 출결(10회)', '등록일', '관리'].map(header => (
                                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStudents.map(student => {
                                const summary = getAttendanceSummary(student.id);
                                return (
                                <tr key={student.id} className="hover:bg-blue-50/50 cursor-pointer transition duration-100" onClick={() => handlePageChange('students', student.id)}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.school}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">고{student.grade}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${student.status === '재원생' ? 'text-green-600' : 'text-gray-500'}`}>
                                        {student.status}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {getClassesNames(student.classes)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className="font-semibold text-green-600">출석 {summary['출석']}</span>
                                        <span className="text-yellow-600 ml-2">지각 {summary['지각']}</span>
                                        <span className="text-red-600 ml-2">결석 {summary['결석']}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.registeredDate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); openMemoModal(student);}}
                                                className="text-yellow-600 hover:text-yellow-800 p-1 rounded-full hover:bg-yellow-100"
                                                title="메모"
                                            >
                                                <Icon name="fileText" className="w-5 h-5" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); handleEdit(student);}}
                                                className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-100"
                                                title="수정"
                                            >
                                                <Icon name="edit" className="w-5 h-5" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); if(window.confirm(`${student.name} 학생을 정말 삭제하시겠습니까?`)) handleDeleteStudent(student.id);}}
                                                className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-100"
                                                title="삭제"
                                            >
                                                <Icon name="trash" className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <StudentFormModal 
                isOpen={isStudentModalOpen}
                onClose={() => setIsStudentModalOpen(false)}
                student={studentToEdit}
                allClasses={classes}
                onSave={handleSaveStudent}
            />
            <MemoModal
                isOpen={memoModalState.isOpen}
                onClose={closeMemoModal}
                onSave={handleSaveMemo}
                studentId={memoModalState.studentId}
                initialContent={memoModalState.content}
                studentName={memoModalState.studentName}
            />
        </div>
    );
};


// --- VideoProgressViewer 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const VideoProgressViewer = ({ log, students, videoProgress, attendanceLogs }) => {
    // ... (기존 VideoProgressViewer 내용 유지)
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


// --- ClassSelectionPanel (App.jsx에 임시로 남겨둠) ---
const ClassSelectionPanel = ({ classes, selectedClassId, setSelectedClassId, handleClassSave, calculateClassSessions, showSessions = true, selectedDate, handleDateNavigate, showEditButton = false, customPanelContent = null, customPanelTitle = '수업 회차' }) => {
    // ... (기존 ClassSelectionPanel 내용 유지)
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    // 수업 회차 목록
    const sessions = useMemo(() => selectedClass ? calculateClassSessions(selectedClass) : [], [selectedClass, calculateClassSessions]);

    const sessionsBeforeSelectedDate = useMemo(() => {
        if (!selectedDate) return sessions;
        return sessions.filter(s => s.date <= selectedDate);
    }, [sessions, selectedDate]);


    return (
        <div className="w-80 flex-shrink-0 bg-white p-4 rounded-xl shadow-md space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-800">클래스 선택</h3>
                <button 
                    onClick={() => setIsClassModalOpen(true)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium flex items-center"
                >
                    <Icon name="plus" className="w-4 h-4 mr-1" />
                    새 클래스
                </button>
            </div>
            
            <select
                value={selectedClassId || ''}
                onChange={e => setSelectedClassId(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
            >
                <option value="" disabled>클래스를 선택하세요</option>
                {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name} ({cls.teacher})</option>
                ))}
            </select>

            {selectedClass && (
                <div className="border p-3 rounded-lg bg-indigo-50 space-y-2">
                    <p className="text-sm font-semibold text-indigo-700">고{selectedClass.grade} | {selectedClass.schedule.days.join(', ')} ({selectedClass.schedule.time})</p>
                    <p className="text-xs text-indigo-600">총 학생: {selectedClass.students.length}명</p>
                    {showEditButton && (
                        <button 
                            onClick={() => setIsClassModalOpen(true)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center"
                        >
                            <Icon name="edit" className="w-4 h-4 mr-1" />
                            클래스 정보 수정
                        </button>
                    )}
                </div>
            )}

            {selectedClass && showSessions && (
                <div className="pt-2 border-t">
                    <h4 className="text-base font-bold mb-2 flex justify-between items-center text-gray-800">
                        {customPanelTitle} ({sessionsBeforeSelectedDate.length}회)
                        {handleDateNavigate && selectedDate && (
                            <div className="flex space-x-1">
                                <button type="button" onClick={() => handleDateNavigate(-1)} className="p-1 rounded-full hover:bg-gray-200 text-gray-600">
                                    <Icon name="arrow-left" className="w-4 h-4"/>
                                </button>
                                <button type="button" onClick={() => handleDateNavigate(1)} className="p-1 rounded-full hover:bg-gray-200 text-gray-600 rotate-180">
                                    <Icon name="arrow-left" className="w-4 h-4"/>
                                </button>
                            </div>
                        )}
                    </h4>
                    {customPanelContent || (
                        <ul className="space-y-1 max-h-48 overflow-y-auto pr-2 text-sm">
                            {[...sessionsBeforeSelectedDate].reverse().map(session => (
                                <li key={session.date} className={`p-2 rounded-lg transition ${
                                    session.date === selectedDate 
                                        ? 'bg-blue-100 font-bold text-blue-700' 
                                        : 'text-gray-600 hover:bg-gray-50'
                                }`}>
                                    <span className="font-mono text-xs mr-2">{session.date}</span>
                                    {session.session}회차
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            
            <ClassFormModal
                isOpen={isClassModalOpen}
                onClose={() => setIsClassModalOpen(false)}
                onSave={handleClassSave}
                classToEdit={selectedClass}
            />
        </div>
    );
};


// --- LessonManagement 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const LessonManagement = ({ students, classes, lessonLogs, handleSaveLessonLog, handleDeleteLessonLog, handleSaveClass, videoProgress, attendanceLogs, calculateClassSessions, logNotification }) => {
    // ... (기존 LessonManagement 내용 유지)
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
        // 클래스 변경 시, 가장 최근 일지의 날짜로 설정
        if (classLogs.length > 0) {
            setSelectedDate(classLogs[0].date);
        } else {
            setSelectedDate(null);
        }
    }, [selectedClassId, classLogs.length]);

    const currentLog = useMemo(() => {
        return classLogs.find(log => log.date === selectedDate);
    }, [classLogs, selectedDate]);
    
    // 날짜 네비게이션
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
                    
                    if (!isLogged && !isSelected) return null; // 로그가 없는 회차는 표시하지 않음 (선택 사항)

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
        <div className="flex space-x-6 h-full">
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


// --- AttendanceManagement 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const AttendanceManagement = ({ students, classes, attendanceLogs, handleSaveAttendance, studentMemos, handleSaveMemo, handleSaveClass, calculateClassSessions }) => {
    // ... (기존 AttendanceManagement 내용 유지)
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });

    const selectedClass = classes.find(c => c.id === selectedClassId);

    // 해당 클래스, 해당 일자의 출석 기록 필터링
    const classAttendance = useMemo(() => {
        if (!selectedClassId || !selectedDate) return [];
        return attendanceLogs.filter(log => log.classId === selectedClassId && log.date === selectedDate);
    }, [attendanceLogs, selectedClassId, selectedDate]);

    // 해당 클래스의 재원생 목록
    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.students.includes(s.id) && s.status === '재원생').sort((a, b) => a.name.localeCompare(b.name));
    }, [students, selectedClass]);

    // 모달에 전달할 초기 출석 데이터 구성
    const initialAttendanceForModal = useMemo(() => {
        const initial = {};
        classStudents.forEach(s => {
            const existingLog = classAttendance.find(log => log.studentId === s.id);
            initial[s.id] = existingLog || { 
                classId: selectedClassId, 
                date: selectedDate, 
                studentId: s.id, 
                status: '출석' // 기본값은 출석으로 설정
            };
        });
        return initial;
    }, [classStudents, classAttendance, selectedClassId, selectedDate]);
    
    // ClassSelectionPanel의 커스텀 회차 목록 (수업 날짜만 표시)
    const sessionDates = useMemo(() => {
        if (!selectedClass) return [];
        return calculateClassSessions(selectedClass);
    }, [selectedClass, calculateClassSessions]);

    // 날짜 네비게이션
    const handleDateNavigate = (direction) => {
        const currentDateIndex = sessionDates.findIndex(s => s.date === selectedDate);
        if (currentDateIndex === -1) return;

        const newIndex = currentDateIndex + direction;
        
        if (newIndex >= 0 && newIndex < sessionDates.length) {
            setSelectedDate(sessionDates[newIndex].date);
        }
    };

    const openMemoModal = (student) => {
        setMemoModalState({
            isOpen: true,
            studentId: student.id,
            content: studentMemos[student.id] || '',
            studentName: student.name,
        });
    };

    const closeMemoModal = () => {
        setMemoModalState({ isOpen: false, studentId: null, content: '', studentName: '' });
    };

    return (
        <div className="flex space-x-6 h-full">
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
                customPanelContent={null} // 기본 회차 목록 사용
                customPanelTitle="수업 날짜 선택"
            />
            <div className="flex-1 min-w-0">
                {selectedClassId === null ? (
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">클래스를 선택하고 날짜를 지정하여 출결을 관리하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedClass.name} | 
                                <span className="text-blue-600 ml-2">{selectedDate}</span>
                            </h3>
                            <button 
                                onClick={() => setIsAttendanceModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                            >
                                <Icon name="edit" className="w-5 h-5 mr-2" />
                                출결 기록 / 수정
                            </button>
                        </div>
                        
                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <h4 className="text-lg font-bold mb-4 border-b pb-2">학생별 출결 현황 ({classStudents.length}명)</h4>
                            
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {['이름', '학년/학교', '상태', '클리닉 희망', '메모'].map(header => (
                                                <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {classStudents.map(student => {
                                            const attendance = classAttendance.find(log => log.studentId === student.id);
                                            const status = attendance?.status || '미기록';
                                            
                                            let statusColor = 'text-gray-500';
                                            if (status === '출석') statusColor = 'text-green-600';
                                            else if (status === '지각') statusColor = 'text-yellow-600';
                                            else if (status === '결석') statusColor = 'text-red-600 font-bold';
                                            else if (status === '동영상보강') statusColor = 'text-indigo-600';

                                            const memoContent = studentMemos[student.id];

                                            return (
                                                <tr key={student.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">고{student.grade} / {student.school}</td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${statusColor}`}>{status}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.clinicTime || '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <button 
                                                            onClick={() => openMemoModal(student)}
                                                            className={`flex items-center text-xs px-2 py-1 rounded-full ${memoContent ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                        >
                                                            <Icon name="fileText" className="w-4 h-4 mr-1"/>
                                                            {memoContent ? '메모 있음' : '메모 작성'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AttendanceModal
                isOpen={isAttendanceModalOpen}
                onClose={() => setIsAttendanceModalOpen(false)}
                studentsData={classStudents}
                initialAttendance={initialAttendanceForModal}
                onSave={handleSaveAttendance}
            />
            <MemoModal
                isOpen={memoModalState.isOpen}
                onClose={closeMemoModal}
                onSave={handleSaveMemo}
                studentId={memoModalState.studentId}
                initialContent={memoModalState.content}
                studentName={memoModalState.studentName}
            />
        </div>
    );
};


// --- HomeworkManagement 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const HomeworkManagement = ({ students, classes, homeworkAssignments, homeworkResults, handleSaveHomeworkAssignment, handleDeleteHomeworkAssignment, handleUpdateHomeworkResult, handleSaveClass, calculateClassSessions }) => {
    // ... (기존 HomeworkManagement 내용 유지)
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentToEdit, setAssignmentToEdit] = useState(null);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
    
    const selectedClass = classes.find(c => c.id === selectedClassId);
    
    const classAssignments = useMemo(() => {
        if (!selectedClassId) return [];
        return homeworkAssignments
            .filter(a => a.classId === selectedClassId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [homeworkAssignments, selectedClassId]);

    const selectedAssignment = useMemo(() => {
        return classAssignments.find(a => a.id === selectedAssignmentId);
    }, [classAssignments, selectedAssignmentId]);

    // 클래스 학생 목록
    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.students.includes(s.id) && s.status === '재원생').sort((a, b) => a.name.localeCompare(b.name));
    }, [students, selectedClass]);
    
    // 선택된 과제의 결과 요약
    const assignmentSummary = useMemo(() => {
        if (!selectedAssignment) return [];
        
        return classStudents.map(student => {
            const result = homeworkResults[student.id]?.[selectedAssignment.id] || {};
            const total = selectedAssignment.totalQuestions;
            
            let correct = 0;
            let incorrect = 0;
            let corrected = 0;

            Object.values(result).forEach(status => {
                if (status === '맞음') correct++;
                if (status === '틀림') incorrect++;
                if (status === '고침') corrected++;
            });
            
            const completionCount = correct + corrected + incorrect; // 채점된 개수
            const unchecked = total - completionCount;
            const completionRate = Math.round((completionCount / total) * 100) || 0;
            
            return {
                studentId: student.id,
                studentName: student.name,
                total,
                correct,
                incorrect,
                corrected,
                unchecked,
                completionRate,
                isCompleted: unchecked === 0,
                resultMap: result,
            };
        });
    }, [selectedAssignment, classStudents, homeworkResults]);
    
    // 과제 목록 패널
    const assignmentPanelContent = useMemo(() => {
        if (!selectedClass) return <p className="text-sm text-gray-500">클래스를 선택해주세요.</p>;
        
        return (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
                {classAssignments.map(assignment => (
                    <div 
                        key={assignment.id} 
                        onClick={() => setSelectedAssignmentId(assignment.id)}
                        className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                            assignment.id === selectedAssignmentId 
                                ? 'bg-blue-100 border-blue-400 shadow-md' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <p className="text-sm font-bold text-gray-800">{assignment.book} ({assignment.startQuestion}~{assignment.endQuestion})</p>
                        <p className="text-xs text-gray-600 mt-1">{assignment.date}: {assignment.content}</p>
                    </div>
                ))}
                {classAssignments.length === 0 && <p className="text-sm text-gray-500 mt-2">배정된 과제가 없습니다.</p>}
            </div>
        );
    }, [classAssignments, selectedClassId, selectedAssignmentId, selectedClass]);

    const handleEditAssignment = (assignment) => {
        setAssignmentToEdit(assignment);
        setIsAssignmentModalOpen(true);
    };

    const handleNewAssignment = () => {
        setAssignmentToEdit(null);
        setIsAssignmentModalOpen(true);
    };

    const handleUpdateResult = (studentId, qNum, status) => {
        if (!selectedAssignmentId) return;
        handleUpdateHomeworkResult(studentId, selectedAssignmentId, qNum, status);
    };

    return (
        <div className="flex space-x-6 h-full">
            {/* 왼쪽: 클래스 및 과제 목록 패널 */}
            <div className="w-80 flex-shrink-0 space-y-4">
                <ClassSelectionPanel
                    classes={classes}
                    selectedClassId={selectedClassId}
                    setSelectedClassId={setSelectedClassId}
                    handleClassSave={handleSaveClass}
                    calculateClassSessions={calculateClassSessions}
                    showSessions={false}
                    showEditButton={true}
                />
                
                <div className="bg-white p-4 rounded-xl shadow-md space-y-3">
                    <div className='flex justify-between items-center border-b pb-2'>
                        <h4 className="text-lg font-bold text-gray-800">과제 목록</h4>
                        <button 
                            onClick={handleNewAssignment}
                            disabled={!selectedClassId}
                            className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center disabled:text-gray-400"
                        >
                            <Icon name="plus" className="w-4 h-4 mr-1" />
                            새 과제
                        </button>
                    </div>
                    {assignmentPanelContent}
                </div>
            </div>

            {/* 오른쪽: 과제 상세 및 채점 테이블 */}
            <div className="flex-1 min-w-0">
                {!selectedAssignment ? (
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">클래스를 선택하고 왼쪽에서 과제를 선택하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">{selectedAssignment.book}</h3>
                                    <p className="text-sm text-gray-600 mt-1">{selectedAssignment.date} | {selectedAssignment.content} ({selectedAssignment.totalQuestions}문항)</p>
                                </div>
                                <div className='flex space-x-2'>
                                    <button 
                                        onClick={() => handleEditAssignment(selectedAssignment)}
                                        className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-indigo-100"
                                    >
                                        <Icon name="edit" className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => { if(window.confirm('정말 이 과제 기록을 삭제하시겠습니까?')) handleDeleteHomeworkAssignment(selectedAssignment.id); }}
                                        className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100"
                                    >
                                        <Icon name="trash" className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 채점 테이블 */}
                        <HomeworkGradingTable 
                            summary={assignmentSummary} 
                            assignment={selectedAssignment} 
                            handleUpdateResult={handleUpdateResult} 
                        />
                    </div>
                )}
            </div>
            
            <HomeworkAssignmentModal
                isOpen={isAssignmentModalOpen}
                onClose={() => setIsAssignmentModalOpen(false)}
                onSave={handleSaveHomeworkAssignment}
                classId={selectedClassId}
                assignment={assignmentToEdit}
                students={students}
                selectedClass={selectedClass}
            />
        </div>
    );
};

// --- HomeworkGradingTable (App.jsx에 임시로 남겨둠) ---
const RESULT_OPTIONS_HOMEWORK = { '맞음': 'text-green-600 bg-green-100', '틀림': 'text-red-600 bg-red-100', '고침': 'text-blue-600 bg-blue-100' };

const HomeworkGradingTable = ({ summary, assignment, handleUpdateResult }) => {
    const questions = Array.from({ length: assignment.totalQuestions }, (_, i) => i + 1);
    
    const handleStatusChange = (studentId, qNum, currentStatus) => {
        let newStatus;
        if (currentStatus === '맞음') newStatus = '틀림';
        else if (currentStatus === '틀림') newStatus = '고침';
        else if (currentStatus === '고침') newStatus = null; // 초기화
        else newStatus = '맞음'; // 미기록 -> 맞음
        
        handleUpdateResult(studentId, assignment.id, qNum.toString(), newStatus);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
            <h4 className="text-lg font-bold mb-4 border-b pb-2">과제 채점 현황 (클릭하여 상태 변경)</h4>
            <div className='max-h-[60vh] overflow-y-auto'>
                <table className="min-w-full divide-y divide-gray-200 text-xs table-fixed">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="w-16 px-4 py-3 text-left font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 border-r z-10">학생명</th>
                            <th className="w-20 px-4 py-3 text-center font-medium text-gray-500 uppercase">완료율</th>
                            {questions.map(q => (
                                <th key={q} className="w-8 px-1 py-3 text-center font-medium text-gray-500 border-l">{q}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {summary.map(s => (
                            <tr key={s.studentId} className="hover:bg-gray-50">
                                <td className="w-16 px-4 py-2 whitespace-nowrap font-semibold text-gray-900 sticky left-0 bg-white hover:bg-gray-50 border-r z-10">{s.studentName}</td>
                                <td className={`w-20 px-4 py-2 whitespace-nowrap text-center font-bold ${s.completionRate === 100 ? 'text-green-600' : (s.completionRate > 0 ? 'text-blue-600' : 'text-red-500')}`}>
                                    {s.completionRate}%
                                </td>
                                {questions.map(q => {
                                    const status = s.resultMap[q.toString()];
                                    const statusClass = status ? RESULT_OPTIONS_HOMEWORK[status] : 'bg-gray-200 text-gray-500';
                                    
                                    return (
                                        <td 
                                            key={q} 
                                            onClick={() => handleStatusChange(s.studentId, q, status)}
                                            className={`w-8 p-1 text-center cursor-pointer transition duration-100 ${statusClass} border-l`}
                                        >
                                            {status ? status[0] : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex space-x-4 text-sm">
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span> 맞음</p>
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span> 틀림</p>
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span> 고침</p>
                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-gray-500 mr-1"></span> 미기록</p>
            </div>
        </div>
    );
};

// --- GradeManagement 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const GradeManagement = ({ students, classes, tests, grades, handleSaveTest, handleDeleteTest, handleUpdateGrade, handleSaveClass, calculateClassSessions }) => {
    // ... (기존 GradeManagement 내용 유지)
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || null);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testToEdit, setTestToEdit] = useState(null);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [selectedTestId, setSelectedTestId] = useState(null);
    
    const selectedClass = classes.find(c => c.id === selectedClassId);

    // 클래스 학생 목록 및 시험 목록
    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.students.includes(s.id) && s.status === '재원생').sort((a, b) => a.name.localeCompare(b.name));
    }, [students, selectedClass]);
    
    const classTests = useMemo(() => {
        if (!selectedClassId) return [];
        return tests
            .filter(t => t.classId === selectedClassId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [tests, selectedClassId]);

    const selectedTest = useMemo(() => {
        return classTests.find(t => t.id === selectedTestId);
    }, [classTests, selectedTestId]);

    // 클래스 학생들의 시험별 평균 점수 계산
    const classAverages = useMemo(() => {
        const averages = {};
        
        classTests.forEach(test => {
            let totalScore = 0;
            let count = 0;
            
            classStudents.forEach(student => {
                const score = grades[student.id]?.[test.id]?.score;
                if (score !== undefined && score !== null) {
                    totalScore += Number(score);
                    count++;
                }
            });
            averages[test.id] = count > 0 ? (totalScore / count) : 0;
        });
        return averages;
    }, [classTests, classStudents, grades]);
    
    useEffect(() => {
        // 클래스 변경 시, 가장 최근 시험으로 선택
        if (classTests.length > 0) {
            setSelectedTestId(classTests[0].id);
        } else {
            setSelectedTestId(null);
        }
    }, [selectedClassId, classTests.length]);

    const handleNewTest = () => {
        setTestToEdit(null);
        setIsTestModalOpen(true);
    };

    const handleEditTest = (test) => {
        setTestToEdit(test);
        setIsTestModalOpen(true);
    };

    const handleOpenResultModal = (test) => {
        setSelectedTestId(test.id);
        setIsResultModalOpen(true);
    };
    
    // 시험 목록 패널 컨텐츠
    const testPanelContent = useMemo(() => {
        return (
            <div className="max-h-72 overflow-y-auto pr-2">
                {classTests.map(test => (
                    <div 
                        key={test.id} 
                        onClick={() => setSelectedTestId(test.id)}
                        className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                            test.id === selectedTestId 
                                ? 'bg-red-100 border-red-400 shadow-md' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <p className="text-sm font-bold text-gray-800">{test.name}</p>
                        <p className="text-xs text-gray-600 mt-1">{test.date} | 총점 {test.maxScore}점</p>
                    </div>
                ))}
                {classTests.length === 0 && <p className="text-sm text-gray-500 mt-2">등록된 시험이 없습니다.</p>}
            </div>
        );
    }, [classTests, selectedTestId]);

    return (
        <div className="flex space-x-6 h-full">
            {/* 왼쪽: 클래스 및 시험 목록 패널 */}
            <div className="w-80 flex-shrink-0 space-y-4">
                <ClassSelectionPanel
                    classes={classes}
                    selectedClassId={selectedClassId}
                    setSelectedClassId={setSelectedClassId}
                    handleClassSave={handleSaveClass}
                    calculateClassSessions={calculateClassSessions}
                    showSessions={false}
                    showEditButton={true}
                />
                <div className="bg-white p-4 rounded-xl shadow-md space-y-3">
                    <div className='flex justify-between items-center border-b pb-2'>
                        <h4 className="text-lg font-bold text-gray-800">시험 목록</h4>
                        <button 
                            onClick={handleNewTest}
                            disabled={!selectedClassId}
                            className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center disabled:text-gray-400"
                        >
                            <Icon name="plus" className="w-4 h-4 mr-1" />
                            새 시험 등록
                        </button>
                    </div>
                    {testPanelContent}
                </div>
            </div>

            {/* 오른쪽: 성적 테이블 */}
            <div className="flex-1 min-w-0">
                {selectedClassId === null ? (
                    <div className="p-6 bg-white rounded-xl shadow-md"><p className="text-gray-500">클래스를 선택하세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500">
                            <h3 className="text-xl font-bold text-gray-800">{selectedClass.name} 성적 현황}</h3>
                            <p className="text-sm text-gray-600 mt-1">총 {classTests.length}개의 시험이 등록되어 있습니다.</p>
                        </div>

                        {/* 전체 성적 테이블 */}
                        <FullGradeTable 
                            classStudents={classStudents}
                            classTests={classTests}
                            grades={grades}
                            classAverages={classAverages}
                            handleEditTest={handleEditTest}
                            handleDeleteTest={handleDeleteTest}
                            handleOpenResultModal={handleOpenResultModal}
                        />

                    </div>
                )}
            </div>
            
            <TestFormModal
                isOpen={isTestModalOpen}
                onClose={() => setIsTestModalOpen(false)}
                onSave={handleSaveTest}
                classId={selectedClassId}
                test={testToEdit}
                classes={classes}
                calculateClassSessions={calculateClassSessions}
            />
            {selectedTest && (
                <TestResultTable
                    isOpen={isResultModalOpen}
                    onClose={() => setIsResultModalOpen(false)}
                    test={selectedTest}
                    studentsData={classStudents}
                    handleUpdateGrade={handleUpdateGrade}
                    grades={grades}
                />
            )}
        </div>
    );
};


// --- PaymentManagement 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const PaymentManagement = () => { 
    // ... (기존 PaymentManagement 내용 유지)
    const initialBookList = [
        { id: 1, name: 'RPM 수학(상)', price: 15000, stock: 50 },
        { id: 2, name: '블랙라벨 수학(상)', price: 17000, stock: 35 },
        { id: 3, name: '개념원리 수학I', price: 18000, stock: 20 },
        { id: 4, name: '고1 정석', price: 22000, stock: 10 },
    ];
    const [bookList, setBookList] = useState(initialBookList);
    const [newBook, setNewBook] = useState({ name: '', price: 0, stock: 0 });
    const [activeTab, setActiveTab] = useState('stock');

    const handleAddBook = (e) => {
        e.preventDefault();
        if (newBook.name && newBook.price > 0 && newBook.stock >= 0) {
            const id = bookList.reduce((max, b) => Math.max(max, b.id), 0) + 1;
            setBookList(prev => [...prev, { ...newBook, id }]);
            setNewBook({ name: '', price: 0, stock: 0 });
        }
    };
    
    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800">교재 및 수납 관리</h3>
            
            <div className="flex border-b">
                {['stock', 'payment'].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-lg font-medium transition duration-150 ${
                            activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab === 'stock' ? '교재 재고 관리' : '수납 현황 (미구현)'}
                    </button>
                ))}
            </div>
            
            {activeTab === 'stock' && (
                <div className="bg-white p-6 rounded-xl shadow-md grid grid-cols-2 gap-8">
                    {/* 교재 등록 폼 */}
                    <div>
                        <h4 className="text-xl font-bold mb-4 border-b pb-2 text-gray-800">새 교재 등록</h4>
                        <form onSubmit={handleAddBook} className="space-y-3 p-4 border rounded-lg bg-gray-50">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">교재명</label>
                                <input type="text" value={newBook.name} onChange={e => setNewBook({...newBook, name: e.target.value})} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">단가 (원)</label>
                                    <input type="number" value={newBook.price} onChange={e => setNewBook({...newBook, price: Number(e.target.value)})} required min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">초기 재고</label>
                                    <input type="number" value={newBook.stock} onChange={e => setNewBook({...newBook, stock: Number(e.target.value)})} required min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition duration-150">
                                <Icon name="plus" className="w-5 h-5 mr-2" />
                                교재 등록
                            </button>
                        </form>
                    </div>

                    {/* 현재 재고 현황 */}
                    <div>
                        <h4 className="text-xl font-bold mb-4 border-b pb-2 text-gray-800">현재 교재 재고</h4>
                        <div className="overflow-y-auto max-h-96 rounded-lg border">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {['교재명', '단가', '재고'].map(header => (
                                            <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {bookList.map(book => (
                                        <tr key={book.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{book.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.price.toLocaleString()}원</td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${book.stock < 10 ? 'text-red-500' : 'text-green-600'}`}>
                                                {book.stock}권
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'payment' && (
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <p className="text-gray-500">수납 현황 기능은 다음 업데이트에서 구현될 예정입니다.</p>
                </div>
            )}
        </div>
    );
};

// --- BookManagement 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const BookManagement = ({ students, handleSaveStudent, classes }) => {
    // 이 컴포넌트는 PaymentManagement 내에 통합되었거나, 학생 상세 페이지에서 관리되므로, 여기서는 임시로 간단한 기능을 유지합니다.
    return (
        <div className="p-6 bg-white rounded-xl shadow-md">
            <h3 className="text-xl font-bold">교재 관리 (학생별)</h3>
            <p className="text-sm text-gray-500 mt-2">학생 정보 수정 모달에서 학생별 교재 수령 여부를 관리할 수 있습니다.</p>
        </div>
    );
};

// --- ClinicManagement 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const ClinicManagement = ({ students, clinicLogs, handleSaveClinicLog, handleDeleteClinicLog, classes }) => {
    // ... (기존 ClinicManagement 내용 유지)
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState(null);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

    const filteredLogs = useMemo(() => {
        return clinicLogs
            .filter(log => log.date === filterDate)
            .sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
    }, [clinicLogs, filterDate]);

    const studentMap = useMemo(() => {
        return students.reduce((map, student) => {
            map[student.id] = student;
            return map;
        }, {});
    }, [students]);

    const handleEditLog = (log) => {
        setLogToEdit(log);
        setIsLogModalOpen(true);
    };

    const handleNewLog = () => {
        setLogToEdit(null);
        setIsLogModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800">클리닉 활동 로그</h3>
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div className='flex items-center space-x-3'>
                        <label className="text-lg font-medium text-gray-700">날짜 선택:</label>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <button 
                        onClick={handleNewLog}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                    >
                        <Icon name="plus" className="w-5 h-5 mr-2" />
                        로그 기록하기
                    </button>
                </div>

                <h4 className="text-xl font-semibold mb-3">{filterDate} 클리닉 현황 ({filteredLogs.length}건)</h4>
                
                <div className="overflow-x-auto rounded-lg border max-h-[70vh] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                {['이름', '학교/학년', '입퇴실 시간', '총 시간', '담당 조교', '활동 내용', '관리'].map(header => (
                                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLogs.map(log => {
                                const student = studentMap[log.studentId];
                                const startTime = log.checkIn;
                                const endTime = log.checkOut;
                                
                                let duration = '-';
                                if (startTime && endTime) {
                                    try {
                                        const start = new Date(`2000/01/01 ${startTime}`);
                                        const end = new Date(`2000/01/01 ${endTime}`);
                                        let diffMs = end - start;
                                        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // 다음날 넘어가는 경우 보정
                                        const hours = Math.floor(diffMs / 3600000);
                                        const minutes = Math.floor((diffMs % 3600000) / 60000);
                                        duration = `${hours > 0 ? hours + 'h' : ''} ${minutes}m`.trim();
                                    } catch {}
                                }
                                
                                return (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.studentName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">고{student?.grade || '-'} / {student?.school || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.checkIn} ~ {log.checkOut || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{duration}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.tutor}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700 max-w-sm truncate" title={log.comment}>{log.comment}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); handleEditLog(log);}}
                                                className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-100"
                                                title="수정"
                                            >
                                                <Icon name="edit" className="w-5 h-5" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {e.stopPropagation(); if(window.confirm('정말 이 클리닉 로그를 삭제하시겠습니까?')) handleDeleteClinicLog(log.id);}}
                                                className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-100"
                                                title="삭제"
                                            >
                                                <Icon name="trash" className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>
            </div>

            <ClinicLogModal
                isOpen={isLogModalOpen}
                onClose={() => setIsLogModalOpen(false)}
                onSave={handleSaveClinicLog}
                logToEdit={logToEdit}
                students={students}
                defaultDate={filterDate}
                classes={classes}
            />
        </div>
    );
};


// --- InternalCommunication 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const InternalCommunication = ({ announcements, handleSaveAnnouncement, setAnnouncements, students, classes, workLogs, handleSaveWorkLog, handleDeleteWorkLog }) => { 
    // ... (기존 InternalCommunication 내용 유지)
    const [activeTab, setActiveTab] = useState('announcements');
    
    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800">내부 소통 및 공지 관리</h3>
            
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

// --- Announcement 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const Announcement = ({ announcements, handleSaveAnnouncement, setAnnouncements, allClasses, allStudents }) => {
    // ... (기존 Announcement 내용 유지)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [announcementToEdit, setAnnouncementToEdit] = useState(null);
    
    // 예약된 공지 (예정 시간 기준), 고정 공지, 일반 공지 분리
    const sortedAnnouncements = useMemo(() => {
        const now = new Date();
        const future = announcements.filter(a => a.scheduleTime && new Date(a.scheduleTime) > now);
        const active = announcements.filter(a => !a.scheduleTime || new Date(a.scheduleTime) <= now);
        
        const pinned = active.filter(a => a.isPinned);
        const general = active.filter(a => !a.isPinned).sort((a, b) => new Date(b.date) - new Date(a.date));

        future.sort((a, b) => new Date(a.scheduleTime) - new Date(b.scheduleTime));

        return { pinned, general, future };
    }, [announcements]);

    const handleEdit = (announcement) => {
        setAnnouncementToEdit(announcement);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if(window.confirm('정말 이 공지사항을 삭제하시겠습니까?')) {
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        }
    };
    
    const getClassNames = (classIds) => {
        return classIds.map(id => allClasses.find(c => c.id === id)?.name).join(', ') || '전체';
    };

    return (
        <div className="space-y-6">
            <div className='flex justify-end'>
                <button 
                    onClick={() => {setAnnouncementToEdit(null); setIsModalOpen(true);}}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                >
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    새 공지 작성
                </button>
            </div>
            
            {/* 예약 공지 */}
            {sortedAnnouncements.future.length > 0 && (
                <div className="border border-yellow-400 bg-yellow-50 p-4 rounded-xl shadow-md space-y-3">
                    <h4 className="text-lg font-bold text-yellow-800 flex items-center">
                        <Icon name="clock" className="w-5 h-5 mr-2"/>
                        예약된 공지 ({sortedAnnouncements.future.length}건)
                    </h4>
                    {sortedAnnouncements.future.map(a => (
                        <div key={a.id} className="p-3 border rounded-lg bg-white flex justify-between items-center">
                            <div>
                                <p className="text-sm font-semibold">{a.title}</p>
                                <p className="text-xs text-orange-600 mt-1">
                                    <Icon name="bell" className="w-3 h-3 inline mr-1"/>
                                    {a.scheduleTime.replace('T', ' ')} 발송 예정 ({getClassNames(a.targetClasses)})
                                </p>
                            </div>
                            <button onClick={() => handleEdit(a)} className="text-sm text-blue-600 hover:underline">수정</button>
                        </div>
                    ))}
                </div>
            )}

            {/* 고정 및 일반 공지 */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h4 className="text-xl font-bold mb-4 border-b pb-2">게시된 공지사항</h4>
                
                {/* 고정 공지 */}
                {sortedAnnouncements.pinned.map(a => (
                    <div key={a.id} className="p-4 border-b border-yellow-200 bg-yellow-50 last:border-b-0 rounded-lg mb-2 shadow-sm flex flex-col space-y-2">
                        <div className='flex justify-between items-start'>
                            <h5 className="text-base font-bold text-yellow-800 flex items-center">
                                <Icon name="pin" className="w-4 h-4 mr-2 text-yellow-600"/>
                                {a.title}
                            </h5>
                            <div className='flex space-x-2 text-sm text-gray-500'>
                                <p className='text-xs text-yellow-700 font-medium'>[대상: {getClassNames(a.targetClasses)}]</p>
                                <p className='text-xs'>{a.date} by {a.author}</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-700 ml-6" dangerouslySetInnerHTML={{ __html: a.content }}></div>
                        <div className='flex justify-end space-x-3 pt-2 border-t border-yellow-200'>
                             <button onClick={() => handleEdit(a)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"><Icon name="edit" className="w-3 h-3 mr-1"/>수정</button>
                             <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:text-red-800 flex items-center"><Icon name="trash" className="w-3 h-3 mr-1"/>삭제</button>
                        </div>
                    </div>
                ))}
                
                {/* 일반 공지 */}
                {sortedAnnouncements.general.map(a => (
                    <div key={a.id} className="p-4 border-b last:border-b-0 hover:bg-gray-50 flex flex-col space-y-2">
                        <div className='flex justify-between items-start'>
                            <h5 className="text-base font-medium text-gray-800">{a.title}</h5>
                            <div className='flex space-x-3 text-sm text-gray-500'>
                                <p className='text-xs text-blue-700 font-medium'>[대상: {getClassNames(a.targetClasses)}]</p>
                                <p className='text-xs'>{a.date} by {a.author}</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-700 ml-1" dangerouslySetInnerHTML={{ __html: a.content }}></div>
                        <div className='flex justify-end space-x-3 pt-2 border-t mt-2'>
                             <button onClick={() => handleEdit(a)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"><Icon name="edit" className="w-3 h-3 mr-1"/>수정</button>
                             <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:text-red-800 flex items-center"><Icon name="trash" className="w-3 h-3 mr-1"/>삭제</button>
                        </div>
                    </div>
                ))}

                {sortedAnnouncements.pinned.length === 0 && sortedAnnouncements.general.length === 0 && (
                    <p className="text-sm text-gray-500 p-4 text-center">현재 게시된 공지사항이 없습니다.</p>
                )}
            </div>

            <AnnouncementModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveAnnouncement}
                announcementToEdit={announcementToEdit}
                allClasses={allClasses}
                allStudents={allStudents}
            />
        </div>
    );
};

// --- WorkLogs 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const WorkLogs = ({ logs, handleSaveLog, handleDeleteLog }) => { 
    // ... (기존 WorkLogs 내용 유지)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState(null);
    const [newContent, setNewContent] = useState('');

    const sortedLogs = useMemo(() => {
        return [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [logs]);

    const handleEdit = (log) => {
        setLogToEdit(log);
        setNewContent(log.content);
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newContent) return;

        const logData = {
            id: logToEdit ? logToEdit.id : null,
            content: newContent,
        };

        handleSaveLog(logData, !!logToEdit);
        setNewContent('');
        setIsModalOpen(false);
        setLogToEdit(null);
    };

    return (
        <div className="space-y-6">
            <div className='flex justify-end'>
                <button 
                    onClick={() => { setLogToEdit(null); setNewContent(''); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                >
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    새 근무 일지 작성
                </button>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h4 className="text-xl font-bold mb-4 border-b pb-2">전체 근무 일지</h4>
                
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                    {sortedLogs.map(log => (
                        <div key={log.id} className="p-4 border-b last:border-b-0 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{log.date} by <span className="text-gray-800">{log.author}</span></p>
                                </div>
                                <div className='flex space-x-2'>
                                    <button onClick={() => handleEdit(log)} className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-indigo-100" title="수정"><Icon name="edit" className="w-4 h-4"/></button>
                                    <button onClick={() => { if(window.confirm('정말 이 일지를 삭제하시겠습니까?')) handleDeleteLog(log.id); }} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" title="삭제"><Icon name="trash" className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{log.content}</p>
                        </div>
                    ))}
                    {logs.length === 0 && <p className="text-sm text-gray-500 p-4 text-center">작성된 근무 일지가 없습니다.</p>}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={logToEdit ? '근무 일지 수정' : '새 근무 일지 작성'} maxWidth="max-w-xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows="8" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border" placeholder="오늘 수행한 업무, 학생 특이사항, 다음 근무자에게 전달할 내용 등을 작성하세요."></textarea>
                    </div>
                    <div className="pt-4 border-t flex justify-end space-x-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
                            취소
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition duration-150 shadow-md">
                            {logToEdit ? '수정 사항 저장' : '등록하기'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

// --- Messenger 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const Messenger = () => {
    // ... (기존 Messenger 내용 유지)
    return (
        <div className="bg-white p-6 rounded-xl shadow-md h-[70vh] flex items-center justify-center">
            <div className='text-center space-y-2'>
                <Icon name="send" className="w-8 h-8 mx-auto text-gray-400"/>
                <p className="text-lg text-gray-500 font-semibold">내부 메신저</p>
                <p className='text-sm text-gray-500'>교직원 간 1:1 채팅 및 그룹 채팅 기능은 곧 추가될 예정입니다.</p>
            </div>
        </div>
    );
};


// --- StudentDetail Component ---
const StudentDetail = ({ studentId, students, classes, studentMemos, grades, tests, homeworkAssignments, homeworkResults, handlePageChange }) => {
    // ... (기존 StudentDetail 내용 유지)
    const student = students.find(s => s.id === studentId);
    
    // 학생 정보가 없으면 에러 처리
    if (!student) {
        return (
            <div className="p-6 bg-white rounded-xl shadow-md">
                <p className="text-red-500">학생 정보를 찾을 수 없습니다. (ID: {studentId})</p>
                <button 
                    onClick={() => handlePageChange('students')} 
                    className="mt-4 text-blue-600 hover:underline flex items-center"
                >
                    <Icon name="arrow-left" className="w-4 h-4 mr-1"/> 학생 목록으로 돌아가기
                </button>
            </div>
        );
    }
    
    const studentClasses = student.classes.map(id => classes.find(c => c.id === id)).filter(c => c);
    
    // 유틸리티 함수를 이용한 데이터 계산
    const gradeComparison = calculateGradeComparison(studentId, classes, tests, grades);
    const homeworkStats = calculateHomeworkStats(studentId, homeworkAssignments, homeworkResults);
    
    // 최근 성적 4개만 표시
    const recentGrades = gradeComparison.slice(-4).reverse();
    
    // 최근 과제 4개만 표시
    const recentHomeworks = homeworkStats.slice(0, 4);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
                <div className='flex items-center space-x-4'>
                    <button 
                        onClick={() => handlePageChange('students')} 
                        className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition duration-150"
                        title="학생 목록으로 돌아가기"
                    >
                        <Icon name="arrow-left" className="w-6 h-6"/>
                    </button>
                    <h3 className="text-2xl font-bold text-gray-800">
                        {student.name} 학생 상세 대시보드
                    </h3>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
                {/* 1. 기본 정보 & 메모 */}
                <div className="col-span-1 bg-white p-6 rounded-xl shadow-md space-y-3 h-full">
                    <h4 className="text-lg font-bold border-b pb-2 text-gray-800">기본 정보</h4>
                    <p className="text-sm"><span className="font-medium text-gray-600">상태:</span> <span className={`font-bold ${student.status === '재원생' ? 'text-green-600' : 'text-red-600'}`}>{student.status}</span></p>
                    <p className="text-sm"><span className="font-medium text-gray-600">학교/학년:</span> {student.school} (고{student.grade})</p>
                    <p className="text-sm"><span className="font-medium text-gray-600">클래스:</span> <span className="font-medium text-blue-600">{studentClasses.map(c => c.name).join(', ') || '-'}</span></p>
                    <p className="text-sm"><span className="font-medium text-gray-600">연락처:</span> {student.phone} / {student.parentPhone}</p>
                    <p className="text-sm"><span className="font-medium text-gray-600">클리닉:</span> {student.clinicTime || '미정'}</p>
                    
                    <h4 className="text-lg font-bold border-b pt-4 pb-2 text-gray-800">교직원 메모</h4>
                    <div className="text-sm p-3 bg-yellow-50 rounded-lg border border-yellow-200 min-h-20">
                        <p className="whitespace-pre-wrap text-gray-700">{studentMemos[studentId] || '작성된 메모가 없습니다.'}</p>
                    </div>
                </div>

                {/* 2. 성적 요약 그래프 */}
                <div className="col-span-2 bg-white p-6 rounded-xl shadow-md">
                    <h4 className="text-lg font-bold border-b pb-2 text-gray-800 flex justify-between items-center">
                        최근 성적 비교 (클래스 평균 대비)
                        <button onClick={() => handlePageChange('grades')} className='text-sm text-indigo-600 hover:underline'>전체 성적 보기</button>
                    </h4>
                    {recentGrades.length > 0 ? (
                        <div className="mt-4 space-y-4">
                            {recentGrades.map((g, index) => (
                                <div key={index} className="border p-3 rounded-lg bg-gray-50">
                                    <p className="text-sm font-semibold">{g.testName} ({g.className})</p>
                                    <div className="flex items-center mt-1">
                                        <div className="flex-1 mr-4">
                                            <p className="text-xs text-gray-600">학생 점수: <span className="font-bold text-red-600">{g.studentScore}점</span></p>
                                            <p className="text-xs text-gray-600">평균 점수: <span className="font-bold text-blue-600">{g.classAverage}점</span></p>
                                        </div>
                                        <div className="w-1/3 text-center">
                                            <p className={`font-bold ${g.isAboveAverage ? 'text-green-600' : 'text-red-600'}`}>
                                                {g.scoreDifference}점 {g.isAboveAverage ? '⬆️' : '⬇️'}
                                            </p>
                                            <p className="text-xs text-gray-500">평균과의 차이</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 mt-4">기록된 성적이 없습니다.</p>
                    )}
                </div>

                {/* 3. 과제 현황 */}
                <div className="col-span-3 bg-white p-6 rounded-xl shadow-md">
                    <h4 className="text-lg font-bold border-b pb-2 text-gray-800 flex justify-between items-center">
                        최근 과제 수행 현황
                        <button onClick={() => handlePageChange('homework')} className='text-sm text-indigo-600 hover:underline'>전체 과제 보기</button>
                    </h4>
                    <div className="mt-4 grid grid-cols-4 gap-4">
                        {recentHomeworks.length > 0 ? (
                            recentHomeworks.map(h => (
                                <div key={h.id} className={`p-4 rounded-lg border ${h.isCompleted ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
                                    <p className="text-sm font-semibold truncate" title={h.content}>{h.content}</p>
                                    <p className="text-xs text-gray-600 mt-1">{h.book}</p>
                                    <div className="mt-2">
                                        <p className="text-xs text-gray-500">완료율</p>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div 
                                                className="h-2.5 rounded-full" 
                                                style={{ width: `${h.completionRate}%`, backgroundColor: h.isCompleted ? '#10B981' : '#F87171' }}
                                            ></div>
                                        </div>
                                        <p className={`text-sm font-bold mt-1 ${h.isCompleted ? 'text-green-600' : 'text-red-600'}`}>{h.completionRate}%</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="col-span-4 text-sm text-gray-500">배정된 과제가 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- FullGradeTable 컴포넌트 (App.jsx에 임시로 남겨둠) ---
const FullGradeTable = ({ classStudents, classTests, grades, classAverages, handleEditTest, handleDeleteTest, handleOpenResultModal }) => {
    // ... (기존 FullGradeTable 내용 유지)
    return (
        <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
            <h4 className="text-lg font-bold mb-4 border-b pb-2">전체 시험 성적 상세</h4>
            <div className='max-h-[70vh] overflow-y-auto'>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="w-32 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 border-r z-10">학생명</th>
                            {classTests.map(test => (
                                <th key={test.id} className="w-32 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    <div className='flex flex-col'>
                                        <span className='font-bold text-gray-700'>{test.name}</span>
                                        <span className='font-normal text-xs text-red-500'>{test.maxScore}점 만점</span>
                                        <div className='flex justify-center space-x-1 mt-1'>
                                            <button onClick={(e) => {e.stopPropagation(); handleEditTest(test);}} className='text-blue-500 hover:text-blue-700' title="시험 정보 수정"><Icon name="edit" className="w-3 h-3"/></button>
                                            <button onClick={(e) => {e.stopPropagation(); if(window.confirm('시험을 삭제하면 모든 성적도 삭제됩니다.')) handleDeleteTest(test.id);}} className='text-red-500 hover:text-red-700' title="시험 삭제"><Icon name="trash" className="w-3 h-3"/></button>
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                        {/* 평균 점수 행 */}
                        <tr>
                            <th className="px-6 py-2 text-left text-xs font-bold text-gray-700 sticky left-0 bg-gray-100 border-r z-10">클래스 평균</th>
                            {classTests.map(test => (
                                <th key={test.id} className="px-4 py-2 text-center text-sm font-bold bg-gray-100">
                                    {classAverages[test.id] ? classAverages[test.id].toFixed(1) + '점' : '-'}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {classStudents.map(student => (
                            <tr key={student.id} className="hover:bg-gray-50 text-xs">
                                <td className="px-6 py-2 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-1 border-r text-sm">
                                    {student.name}
                                </td>
                                {classTests.map(test => {
                                    const scoreData = grades[student.id]?.[test.id] || {};
                                    // 소수점 첫째 자리까지 표시되도록 조정
                                    const score = scoreData.score === undefined ? '-' : 
                                                  scoreData.score === null ? '미응시' : Number(scoreData.score).toFixed(1);
                                    
                                    return (
                                        <td key={test.id} className="px-4 py-2 whitespace-nowrap text-center cursor-pointer hover:bg-red-50/30" onClick={() => handleOpenResultModal(test)}>
                                            {/* 🚨 글자 크기 조정 및 "점" 텍스트 나란히 배치 */}
                                            <span className={`font-bold text-sm ${score === '미응시' ? 'text-red-500' : 'text-gray-800'}`}>
                                                {score === '-' ? '-' : score}
                                                {score !== '-' && score !== '미응시' && <span className="text-xs font-normal ml-0.5">점</span>}
                                            </span>
                                            {score !== '-' && score !== '미응시' && (
                                                <p className='text-xs text-blue-500 hover:underline'>채점</p>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- TestResultTable 컴포넌트 (모달 형식으로 변경) ---
const RESULT_OPTIONS_GRADE = { '맞음': 'text-green-600', '틀림': 'text-red-600', '고침': 'text-blue-600', '미채점': 'text-gray-500' };

const getStatusColor = (statusKey) => {
    return RESULT_OPTIONS_GRADE[statusKey] || 'text-gray-500';
};

const TestResultTable = ({ isOpen, onClose, test, studentsData, handleUpdateGrade, grades }) => {
    // ... (기존 TestResultTable 내용 유지, 모달로 감싸기)
    const [selectedStudentId, setSelectedStudentId] = useState(studentsData[0]?.id || null);
    const [resultMapping, setResultMapping] = useState({});
    
    const selectedStudent = useMemo(() => studentsData.find(s => s.id === selectedStudentId), [studentsData, selectedStudentId]);

    // 해당 학생의 기존 결과 불러오기
    useEffect(() => {
        if (selectedStudentId) {
            const existing = grades[selectedStudentId]?.[test.id]?.correctCount || {};
            setResultMapping(existing);
        }
    }, [selectedStudentId, test.id, grades]);
    
    // 채점 상태 변경 핸들러
    const handleResultChange = (qNum) => {
        const currentStatus = resultMapping[qNum] || '미채점';
        let newStatus;
        
        // 상태 순환: 미채점 -> 맞음 -> 틀림 -> 고침 -> 맞음... (맞음/틀림/고침만 저장, 미채점은 null)
        if (currentStatus === '맞음') newStatus = ' 틀림';
        else if (currentStatus === '틀림') newStatus = '고침';
        else if (currentStatus === '고침') newStatus = '미채점'; // 미채점은 다음 클릭 시 맞음으로 변경되도록
        else newStatus = '맞음'; 
        
        setResultMapping(prev => {
            const newMap = { ...prev };
            if (newStatus === '미채점') {
                delete newMap[qNum];
            } else {
                newMap[qNum] = newStatus;
            }
            return newMap;
        });
    };
    
    const calculateCurrentScore = useMemo(() => {
        let score = 0;
        Object.keys(resultMapping).forEach(qNum => {
            const status = resultMapping[qNum];
            const qIndex = Number(qNum) - 1;
            const qScore = test.questionScores[qIndex] || 0;
            
            if (status === '맞음' || status === '고침') {
                score += qScore;
            }
        });
        return score.toFixed(1);
    }, [resultMapping, test.questionScores]);
    
    const handleSubmit = (isNoShow = false) => {
        if (selectedStudentId === null) return;
        
        const finalResult = isNoShow ? '미응시' : resultMapping;
        
        handleUpdateGrade(selectedStudentId, test.id, finalResult);
    };

    const studentsInClass = studentsData.filter(s => grades[s.id]?.[test.id] !== undefined || s.status === '재원생'); // 미기록 학생 포함

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${test.name} 문항별 채점`} maxWidth="max-w-6xl">
            <div className='flex space-x-4 h-[70vh]'>
                {/* 왼쪽: 학생 목록 및 점수 요약 */}
                <div className='w-1/4 space-y-3 border-r pr-4 overflow-y-auto'>
                    <h4 className='text-sm font-bold text-gray-700'>학생 선택 ({test.maxScore}점 만점)</h4>
                    {studentsInClass.map(student => {
                        const studentScore = grades[student.id]?.[test.id]?.score;
                        const scoreDisplay = studentScore === null ? '미응시' : (studentScore === undefined ? '-' : `${Number(studentScore).toFixed(1)}점`);
                        const isSelected = student.id === selectedStudentId;
                        
                        return (
                            <div 
                                key={student.id} 
                                onClick={() => setSelectedStudentId(student.id)}
                                className={`p-2 rounded-lg cursor-pointer flex justify-between items-center transition ${isSelected ? 'bg-indigo-100 border border-indigo-500' : 'hover:bg-gray-100 border'}`}
                            >
                                <span className={`text-sm font-medium ${isSelected ? 'text-indigo-800' : 'text-gray-700'}`}>{student.name}</span>
                                <span className={`text-xs font-bold ${studentScore === null ? 'text-red-500' : 'text-gray-800'}`}>{scoreDisplay}</span>
                            </div>
                        );
                    })}
                </div>
                
                {/* 오른쪽: 채점 그리드 */}
                <div className='flex-1 space-y-4 min-w-0'>
                    {selectedStudentId === null ? (
                        <p className="text-gray-500">채점을 시작할 학생을 선택해주세요.</p>
                    ) : (
                        <>
                            <div className='p-3 bg-red-50 border border-red-300 rounded-lg flex justify-between items-center'>
                                <h5 className='text-lg font-bold text-red-800'>
                                    {selectedStudent.name} 학생 채점 중: 현재 점수 <span className='text-2xl ml-2'>{calculateCurrentScore}</span>점
                                </h5>
                                <div className='space-x-2'>
                                    <button 
                                        type='button' 
                                        onClick={() => handleSubmit(true)}
                                        className='px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700'
                                    >
                                        <Icon name="x" className='w-4 h-4 inline mr-1'/> 미응시 처리
                                    </button>
                                    <button 
                                        type='button' 
                                        onClick={() => handleSubmit(false)}
                                        className='px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700'
                                    >
                                        <Icon name="save" className='w-4 h-4 inline mr-1'/> 점수 저장
                                    </button>
                                </div>
                            </div>
                            
                            <div className='grid grid-cols-10 gap-2 overflow-y-auto pr-2 h-[55vh]'>
                                {Array.from({ length: test.totalQuestions }, (_, i) => i + 1).map(qNum => {
                                    const qIndex = qNum - 1;
                                    const score = test.questionScores[qIndex] || 0;
                                    const status = resultMapping[qNum] || '미채점';
                                    const statusClass = getStatusColor(status);
                                    
                                    return (
                                        <div 
                                            key={qNum} 
                                            onClick={() => handleResultChange(qNum.toString())}
                                            className={`p-2 rounded-lg border cursor-pointer transition duration-150 text-center ${status === '미채점' ? 'bg-gray-100 hover:bg-gray-200' : `bg-white hover:opacity-80 border-2 ${statusClass.replace('text', 'border')}`}`}
                                        >
                                            <p className='text-xs font-bold'>{qNum}. ({score}점)</p>
                                            <p className={`text-sm font-bold mt-1 ${statusClass}`}>{status}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className='flex space-x-4 text-sm mt-3'>
                                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span> 맞음</p>
                                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span> 틀림</p>
                                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span> 고침</p>
                                <p className="flex items-center"><span className="w-3 h-3 rounded-full bg-gray-500 mr-1"></span> 미채점</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};