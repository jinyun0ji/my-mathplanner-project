import React, { useState, useMemo, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Icon, formatGradeLabel } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel'; 
import { AttendanceModal } from '../components/common/AttendanceModal'; 
import { MemoModal } from '../utils/modals/MemoModal'; 
import { getDefaultClassId } from '../utils/classStatus';
import { db } from '../firebase/client';

export default function AttendanceManagement({ 
    classes, attendanceLogs, handleSaveAttendance,
    studentMemos, handleSaveMemo, handleSaveClass, calculateClassSessions 
}) {
    const [selectedClassId, setSelectedClassId] = useState(() => getDefaultClassId(classes));
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });
    const [mobileView, setMobileView] = useState('attendance');
    const [classStudents, setClassStudents] = useState([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    const selectedClass = classes.find(c => String(c.id) === String(selectedClassId));

    useEffect(() => {
        if (!classes || classes.length === 0) return;
        if (selectedClassId && classes.some(c => String(c.id) === String(selectedClassId))) return;
        setSelectedClassId(getDefaultClassId(classes));
    }, [classes, selectedClassId]);

    const classAttendance = useMemo(() => {
        if (!selectedClassId || !selectedDate) return [];
        return attendanceLogs.filter(log => log.classId === selectedClassId && log.date === selectedDate);
    }, [attendanceLogs, selectedClassId, selectedDate]);

    useEffect(() => {
        let isActive = true;

        const loadClassStudents = async () => {
            if (!selectedClassId) {
                if (isActive) {
                    setClassStudents([]);
                    setIsLoadingStudents(false);
                }
                return;
            }

            setIsLoadingStudents(true);
            setClassStudents([]);

            try {
                const classRef = doc(db, 'classes', String(selectedClassId));
                const classSnap = await getDoc(classRef);

                if (!classSnap.exists()) {
                    if (isActive) setClassStudents([]);
                    return;
                }

                const { students: classStudentIds = [], studentIds: legacyStudentIds = [] } = classSnap.data() || {};
                const studentIds = Array.isArray(classStudentIds) && classStudentIds.length > 0
                    ? classStudentIds
                    : legacyStudentIds;
                if (!Array.isArray(studentIds) || studentIds.length === 0) {
                    if (isActive) setClassStudents([]);
                    return;
                }

                const normalizedStudentIds = studentIds.map((id) => String(id));
                const chunks = [];
                for (let i = 0; i < normalizedStudentIds.length; i += 10) {
                    chunks.push(normalizedStudentIds.slice(i, i + 10));
                }

                const fetchedStudents = (
                    await Promise.all(
                        chunks.map(async (chunk) => {
                            const usersQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
                            const usersSnap = await getDocs(usersQuery);
                            return usersSnap.docs.map((docSnap) => {
                                const data = docSnap.data();
                                const uid = data?.uid ?? docSnap.id;
                                return { id: uid, ...data };
                            });
                        }),
                    )
                ).flat();

                const filteredStudents = fetchedStudents
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

                if (isActive) setClassStudents(filteredStudents);
            } catch (error) {
                console.error('[AttendanceManagement] 학생 목록 로드 실패:', error);
                if (isActive) setClassStudents([]);
            } finally {
                if (isActive) setIsLoadingStudents(false);
            }
        };

        loadClassStudents();

        return () => {
            isActive = false;
        };
    }, [selectedClassId]);

    const attendanceSummary = useMemo(() => {
        const summary = { total: classStudents.length, 출석: 0, 지각: 0, 결석: 0, 동영상보강: 0, 미기록: 0 };
        classStudents.forEach(student => {
            const status = classAttendance.find(log => log.studentId === student.id)?.status || '미기록';
            if (summary[status] !== undefined) summary[status] += 1;
            else summary.미기록 += 1;
        });
        return summary;
    }, [classStudents, classAttendance]);

    const initialAttendanceForModal = useMemo(() => {
        const initial = {};
        classStudents.forEach(s => {
            const existingLog = classAttendance.find(log => log.studentId === s.id);
            initial[s.id] = existingLog || { 
                classId: selectedClassId, 
                date: selectedDate, 
                studentId: s.id, 
                status: null
            };
        });
        return initial;
    }, [classStudents, classAttendance, selectedClassId, selectedDate]);
    
    const sessionDates = useMemo(() => {
        if (!selectedClass) return [];
        return calculateClassSessions(selectedClass);
    }, [selectedClass, calculateClassSessions]);

    const currentSessionIndex = useMemo(() => sessionDates.findIndex(s => s.date === selectedDate), [sessionDates, selectedDate]);
    const hasPrevSession = currentSessionIndex > 0;
    const hasNextSession = currentSessionIndex > -1 && currentSessionIndex < sessionDates.length - 1;

    useEffect(() => {
        if (selectedClassId) {
            const today = new Date().toISOString().slice(0, 10);
            
            const pastAndCurrentSessions = sessionDates.filter(s => s.date <= today);
            const isSelectedDateValid = sessionDates.some(s => s.date === selectedDate);
            
            if (!isSelectedDateValid && pastAndCurrentSessions.length > 0) {
                const mostRecentDate = pastAndCurrentSessions[pastAndCurrentSessions.length - 1].date;
                setSelectedDate(mostRecentDate);
            } else if (!isSelectedDateValid && sessionDates.length > 0) {
                 setSelectedDate(sessionDates[0].date);
            }
        }
    }, [selectedClassId, sessionDates, selectedDate]);

    useEffect(() => {
        if (!selectedClassId) setMobileView('class');
    }, [selectedClassId]);


    const handleDateNavigate = (direction) => {
        const currentIndex = sessionDates.findIndex(s => s.date === selectedDate);
        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < sessionDates.length) {
            setSelectedDate(sessionDates[newIndex].date);
        }
    };

    const openMemoModal = (student) => {
        setMemoModalState({
            isOpen: true,
            studentId: student.id,
            content: studentMemos[student.id] ?? student.memo ?? '',
            studentName: student.name,
        });
    };

    const closeMemoModal = () => {
        setMemoModalState({ isOpen: false, studentId: null, content: '', studentName: '' });
    };

    const statusBadgeStyles = {
        '출석': 'bg-green-50 text-green-800 border-green-200',
        '지각': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        '결석': 'bg-red-50 text-red-700 border-red-200',
        '동영상보강': 'bg-indigo-50 text-indigo-800 border-indigo-200',
        '미기록': 'bg-gray-50 text-gray-600 border-gray-200'
    };

    const selectedStudent = memoModalState.studentId ? classStudents.find(s => s.id === memoModalState.studentId) : null;
    const selectedStudentStatus = selectedStudent ? classAttendance.find(log => log.studentId === selectedStudent.id)?.status || '미기록' : null;
    const getMemoContent = (student) => studentMemos[student.id] ?? student.memo ?? '';

    return (
        <div className="space-y-4">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200">
                <div className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Icon name="calendar" className="w-4 h-4 text-indigo-800" />
                            <span>{selectedClass ? selectedClass.name : '클래스를 선택하세요'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Icon name="clock" className="w-4 h-4 text-indigo-800" />
                            <span className="font-semibold text-gray-700">{selectedDate || '날짜 선택'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            {[
                                { label: '출석', value: attendanceSummary['출석'], tone: 'bg-green-50 text-green-800 border-green-200' },
                                { label: '지각', value: attendanceSummary['지각'], tone: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
                                { label: '결석', value: attendanceSummary['결석'], tone: 'bg-red-50 text-red-700 border-red-200' },
                                { label: '동영상보강', value: attendanceSummary['동영상보강'], tone: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                            ].map(item => (
                                <span key={item.label} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border font-semibold ${item.tone}`}>
                                    <span>{item.label}</span>
                                    <span className="text-sm font-bold">{item.value}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                        <button
                            onClick={() => setIsAttendanceModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-md transition"
                        >
                            <Icon name="checkSquare" className="w-5 h-5" />
                            출결 입력
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
                <div className="space-y-4">
                    <ClassSelectionPanel
                        classes={classes}
                        selectedClassId={selectedClassId}
                        setSelectedClassId={setSelectedClassId}
                        handleClassSave={handleSaveClass}
                        calculateClassSessions={calculateClassSessions}
                        showSessions={true}
                        selectedDate={selectedDate}
                        showEditButton={true}
                        customPanelContent={null} 
                        customPanelTitle="수업 날짜 선택"
                        onDateSelect={setSelectedDate} 
                    />
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h4 className="text-lg font-bold text-gray-800">학생별 출결 현황 ({classStudents.length}명)</h4>
                        </div>

                        {selectedClassId === null ? (
                            <p className="text-gray-500">클래스를 선택하고 날짜를 지정하여 출결을 관리하세요.</p>
                        ) : isLoadingStudents ? (
                            <p className="text-gray-500">학생 정보를 불러오는 중입니다.</p>
                        ) : (
                            <>
                                <div className="overflow-x-auto rounded-lg border border-gray-200 hidden md:block">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                {['이름', '학년/학교', '상태', '메모'].map(header => (
                                                    <th key={header} className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {classStudents.map(student => {
                                                const attendance = classAttendance.find(log => log.studentId === student.id);
                                                const status = attendance?.status || '미기록';
                                                const memoContent = getMemoContent(student);
                                                const badgeStyle = statusBadgeStyles[status] || statusBadgeStyles['미기록'];

                                                return (
                                                    <tr key={student.id} className="hover:bg-indigo-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{student.name}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatGradeLabel(student.grade)} / {student.school}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${badgeStyle}`}>
                                                                {status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <button
                                                                onClick={() => openMemoModal(student)}
                                                                className={`flex items-center text-xs px-2 py-1 rounded-full transition-colors ${
                                                                    memoContent
                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                        : 'bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-900'
                                                                }`}
                                                            >
                                                                <Icon name="fileText" className="w-4 h-4 mr-1" />
                                                                {memoContent ? '메모 있음' : '메모 작성'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="grid gap-3 md:hidden">
                                    {classStudents.map(student => {
                                        const attendance = classAttendance.find(log => log.studentId === student.id);
                                        const status = attendance?.status || '미기록';
                                        const memoContent = getMemoContent(student);
                                        const phoneSuffix = student.phone ? student.phone.slice(-4) : '';

                                        const badgeStyle = statusBadgeStyles[status] || statusBadgeStyles['미기록'];
                                        const memoStyle = memoContent ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200';

                                        return (
                                            <div key={student.id} className="p-4 border border-gray-200 rounded-xl shadow-sm bg-white space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-base font-bold text-gray-900 leading-snug">{student.name}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{formatGradeLabel(student.grade)} · {student.school}{phoneSuffix ? ` · ${phoneSuffix}` : ''}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openMemoModal(student)}
                                                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold border transition ${memoStyle} hover:border-indigo-300 hover:bg-indigo-50`}
                                                            title={memoContent ? '메모 있음' : '메모 작성'}
                                                            aria-label={memoContent ? `${student.name} 메모 확인` : `${student.name} 메모 작성`}
                                                        >
                                                            <Icon name="fileText" className="w-4 h-4" />
                                                        </button>
                                                        <span className={`w-10 h-10 rounded-full border flex items-center justify-center text-[11px] font-bold ${badgeStyle}`}>
                                                            {status}
                                                        </span>
                                                    </div>
                                                </div>
                                                {memoContent && (
                                                    <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-2 leading-snug">
                                                        {memoContent}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                </>
                        )}
                    </div>

                    {selectedClassId === null ? (
                        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                            <p className="text-gray-500">클래스를 선택하고 날짜를 지정하여 출결을 관리하세요.</p>
                        </div>
                    ) : selectedStudent ? (
                        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">선택된 학생</p>
                                    <h3 className="text-xl font-bold text-gray-900">{selectedStudent.name}</h3>
                                    <p className="text-sm text-gray-600">{formatGradeLabel(selectedStudent.grade)} · {selectedStudent.school}</p>
                                </div>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold ${selectedStudentStatus ? (statusBadgeStyles[selectedStudentStatus] || statusBadgeStyles['미기록']) : statusBadgeStyles['미기록']}`}>
                                    {selectedStudentStatus || '미기록'}
                                </span>
                            </div>
                            {memoModalState.content ? (
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-gray-800 leading-snug">
                                    {memoModalState.content}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">메모가 없습니다. 학생 행의 메모 버튼을 눌러 메모를 추가하세요.</p>
                            )}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => openMemoModal(selectedStudent)}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200"
                                >
                                    <Icon name="edit" className="w-4 h-4" />
                                    메모 작성/수정
                                </button>
                            </div>
                        </div>
                    ) : null}

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
            </div>
        </div>
    );
};