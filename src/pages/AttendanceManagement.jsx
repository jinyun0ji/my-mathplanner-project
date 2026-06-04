import React, { useState, useMemo, useEffect } from 'react';
import { Icon, formatGradeLabel } from '../utils/helpers';
import { isClosedDate, normalizeDateToYMD } from '../utils/closures';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel';
import { AttendanceModal } from '../components/common/AttendanceModal';
import { MemoModal } from '../utils/modals/MemoModal';
import { getDefaultClassId } from '../utils/classStatus';
import { useClassStudents } from '../utils/useClassStudents';
import { filterRosterByWithdrawDate } from '../utils/rosterFilter';
import { buildStudentParentPhoneLast4Map, formatStudentNameWithParentLast4 } from '../utils/parentPhone';

const toDateKey = (v) => {
    if (!v) return '';
    if (typeof v === 'object' && typeof v.toDate === 'function') {
        return v.toDate().toISOString().slice(0, 10);
    }
    if (v instanceof Date) {
        return v.toISOString().slice(0, 10);
    }
    return String(v).slice(0, 10);
};

export default function AttendanceManagement({
    classes, attendanceLogs, handleSaveAttendance,
    studentMemos, handleSaveMemo, handleSaveClass, calculateClassSessions,
    closures = [],
    students = [],
    parents = [],
}) {
    const [selectedClassId, setSelectedClassId] = useState(() => getDefaultClassId(classes));
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [memoModalState, setMemoModalState] = useState({ isOpen: false, studentId: null, content: '', studentName: '' });
    const [mobileView, setMobileView] = useState('attendance');
    const { students: classStudents, isLoading: isLoadingStudents } = useClassStudents(selectedClassId);

    const selectedClass = classes.find(c => String(c.id) === String(selectedClassId));

    const parentLast4Map = useMemo(
        () => buildStudentParentPhoneLast4Map(students, parents),
        [students, parents],
    );
    const isSelectedDateClosed = useMemo(
        () => (
            selectedClassId && selectedDate
                ? isClosedDate({ date: normalizeDateToYMD(selectedDate), classId: selectedClassId, closures })
                : false
        ),
        [closures, selectedClassId, selectedDate]
    );

    useEffect(() => {
        if (!classes || classes.length === 0) return;
        if (selectedClassId && classes.some(c => String(c.id) === String(selectedClassId))) return;
        setSelectedClassId(getDefaultClassId(classes));
    }, [classes, selectedClassId]);

    const classAttendance = useMemo(() => {
        if (!selectedClassId || !selectedDate) return [];
        return attendanceLogs.filter(log => (
            String(log.classId) === String(selectedClassId)
            && toDateKey(log.date || log.lessonDate || log.dateKey) === selectedDate
        ));
    }, [attendanceLogs, selectedClassId, selectedDate]);

    const rosterForAttendance = useMemo(
        () => filterRosterByWithdrawDate(classStudents, selectedClassId, selectedDate),
        [classStudents, selectedClassId, selectedDate]
    );

    useEffect(() => {
        if (!selectedClassId) return;
        console.log('[출결 명단 확인]');
        console.log('classId=', selectedClassId);
        console.log('targetDate=', selectedDate);
        console.log(
            'before=',
            classStudents.map(student => ({
                name: student.name,
                status: student.classStatusMap?.[selectedClassId]?.status,
                endedAt: student.classStatusMap?.[selectedClassId]?.endedAt
            }))
        );
        console.log('after=', rosterForAttendance.map(student => student.name));
    }, [classStudents, selectedClassId, selectedDate, rosterForAttendance]);

    const resolveStudentAuthUid = (student) => student?.authUid ?? student?.uid ?? null;
    const findAttendanceLogForStudent = (student) => {
        const studentAuthUid = resolveStudentAuthUid(student);
        return classAttendance.find(log => (
            log.studentId === student.id
            || log.studentDocId === student.id
            || (studentAuthUid && log.authUid === studentAuthUid)
        ));
    };

    const attendanceSummary = useMemo(() => {
        const summary = { total: rosterForAttendance.length, 출석: 0, 지각: 0, 결석: 0, 동영상보강: 0, 미기록: 0 };
        rosterForAttendance.forEach(student => {
            const status = findAttendanceLogForStudent(student)?.status || '미기록';
            if (summary[status] !== undefined) summary[status] += 1;
            else summary.미기록 += 1;
        });
        return summary;
    }, [rosterForAttendance, classAttendance]);

    const initialAttendanceForModal = useMemo(() => {
        const initial = {};
        rosterForAttendance.forEach(s => {
            const existingLog = findAttendanceLogForStudent(s);
            initial[s.id] = existingLog || {
                classId: selectedClassId,
                date: selectedDate,
                studentId: s.id,
                status: null
            };
        });
        return initial;
    }, [rosterForAttendance, classAttendance, selectedClassId, selectedDate]);

    const sessionDates = useMemo(() => {
        if (!selectedClass) return [];
        return calculateClassSessions(selectedClass).map(session => ({
            ...session,
            dateKey: toDateKey(session.date),
        }));
    }, [selectedClass, calculateClassSessions]);

    const attendanceDateSet = useMemo(() => {
        const set = new Set();
        if (!selectedClassId) return set;
        (attendanceLogs || []).forEach((log) => {
            if (String(log.classId) !== String(selectedClassId)) return;
            const dateKey = toDateKey(log.date || log.lessonDate || log.dateKey);
            if (dateKey) set.add(dateKey);
        });
        return set;
    }, [attendanceLogs, selectedClassId]);

    const availableSessions = useMemo(() => {
        if (!selectedClass) return [];
        return sessionDates.filter((session) => {
            const dateKey = toDateKey(session.date || session.sessionDate || session.day);
            if (!dateKey) return false;
            if (!selectedClassId) return true;
            const isClosed = isClosedDate({
                date: normalizeDateToYMD(dateKey),
                classId: selectedClassId,
                closures,
            });
            if (!isClosed) return true;
            return attendanceDateSet.has(dateKey);
        });
    }, [attendanceDateSet, closures, selectedClass, selectedClassId, sessionDates]);

    useEffect(() => {
        if (selectedClassId) {
            const today = new Date().toISOString().slice(0, 10);

            const pastAndCurrentSessions = availableSessions.filter(s => s.dateKey <= today);
            const isSelectedDateValid = availableSessions.some(s => s.dateKey === selectedDate);

            if (!isSelectedDateValid && pastAndCurrentSessions.length > 0) {
                const mostRecentDate = pastAndCurrentSessions[pastAndCurrentSessions.length - 1].dateKey;
                setSelectedDate(mostRecentDate);
            } else if (!isSelectedDateValid && availableSessions.length > 0) {
                 setSelectedDate(availableSessions[0].dateKey);
            }
        }
    }, [availableSessions, selectedClassId, selectedDate]);

    useEffect(() => {
        if (!selectedClassId) setMobileView('class');
    }, [selectedClassId]);

    const openMemoModal = (student) => {
        setMemoModalState({
            isOpen: true,
            studentId: student.id,
            content: studentMemos[student.id] ?? student.memo ?? '',
            studentName: student.name,
        });
    };

    const handleAttendanceSave = (records) => {
        handleSaveAttendance(records);
    };

    const closeMemoModal = () => {
        setMemoModalState({ isOpen: false, studentId: null, content: '', studentName: '' });
    };

    const statusBadgeStyles = {
        '출석': 'bg-green-50 text-green-800 border-green-200',
        '지각': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        '결석': 'bg-red-50 text-red-700 border-red-200',
        '동영상보강': 'bg-[#f1f4ff] text-[#334a91] border-[#cfd8ff]',
        '미기록': 'bg-gray-50 text-gray-600 border-gray-200'
    };

    const selectedStudent = memoModalState.studentId ? rosterForAttendance.find(s => s.id === memoModalState.studentId) : null;
    const selectedStudentStatus = selectedStudent ? findAttendanceLogForStudent(selectedStudent)?.status || '미기록' : null;
    const getMemoContent = (student) => studentMemos[student.id] ?? student.memo ?? '';

    return (
        <div className="space-y-4">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200">
                <div className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Icon name="calendar" className="w-4 h-4 text-[#334a91]" />
                            <span>{selectedClass ? selectedClass.name : '클래스를 선택하세요'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Icon name="clock" className="w-4 h-4 text-[#334a91]" />
                            <span className="font-semibold text-gray-700">{selectedDate || '날짜 선택'}</span>
                            {isSelectedDateClosed && (
                                <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-semibold">
                                    휴강
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            {[
                                { label: '출석', value: attendanceSummary['출석'], tone: 'bg-green-50 text-green-800 border-green-200' },
                                { label: '지각', value: attendanceSummary['지각'], tone: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
                                { label: '결석', value: attendanceSummary['결석'], tone: 'bg-red-50 text-red-700 border-red-200' },
                                { label: '동영상보강', value: attendanceSummary['동영상보강'], tone: 'bg-[#f1f4ff] text-[#334a91] border-[#cfd8ff]' },
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
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition text-white bg-[#455fab] hover:bg-[#3b5198]"
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
                        customPanelContent={(
                            <ul className="space-y-1 max-h-48 overflow-y-auto pr-2 text-sm">
                                {availableSessions.length === 0 ? (
                                    <li className="text-xs text-gray-500 py-2">
                                        선택 가능한 수업 회차가 없습니다(휴강 기간).
                                    </li>
                                ) : (
                                    [...availableSessions].reverse().map(session => {
                                        const isSelected = session.dateKey === selectedDate;
                                        return (
                                            <li
                                                key={session.dateKey}
                                                onClick={() => setSelectedDate(session.dateKey)}
                                                className={`p-2 rounded-lg transition ${
                                                    isSelected
                                                        ? 'bg-blue-100 font-bold text-[#334a91]'
                                                        : 'text-gray-600 hover:bg-gray-50'
                                                } cursor-pointer`}
                                            >
                                                <span className="font-mono text-xs mr-2">{session.dateKey}</span>
                                                {session.session}회차
                                            </li>
                                        );
                                    })
                                )}
                            </ul>
                        )}
                        customPanelTitle="수업 날짜 선택"
                        onDateSelect={(date) => setSelectedDate(toDateKey(date))}
                    />
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h4 className="text-lg font-bold text-gray-800">학생별 출결 현황 ({rosterForAttendance.length}명)</h4>
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
                                            {rosterForAttendance.map(student => {
                                                const attendance = findAttendanceLogForStudent(student);
                                                const status = attendance?.status || '미기록';
                                                const memoContent = getMemoContent(student);
                                                const badgeStyle = statusBadgeStyles[status] || statusBadgeStyles['미기록'];

                                                return (
                                                    <tr key={student.id} className="hover:bg-[#f1f4ff] transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{formatStudentNameWithParentLast4(student, parentLast4Map)}</td>
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
                                                                        : 'bg-gray-100 text-gray-500 hover:bg-[#eef2ff] hover:text-[#334a91]'
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
                                    {rosterForAttendance.map(student => {
                                        const attendance = findAttendanceLogForStudent(student);
                                        const status = attendance?.status || '미기록';
                                        const memoContent = getMemoContent(student);
                                        const phoneSuffix = parentLast4Map[String(student.id)] || '';

                                        const badgeStyle = statusBadgeStyles[status] || statusBadgeStyles['미기록'];
                                        const memoStyle = memoContent ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200';

                                        return (
                                            <div key={student.id} className="p-4 border border-gray-200 rounded-xl shadow-sm bg-white space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-base font-bold text-gray-900 leading-snug">{formatStudentNameWithParentLast4(student, parentLast4Map)}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{formatGradeLabel(student.grade)} · {student.school}{phoneSuffix ? ` · ${phoneSuffix}` : ''}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openMemoModal(student)}
                                                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold border transition ${memoStyle} hover:border-[#cfd8ff] hover:bg-[#f1f4ff]`}
                                                            title={memoContent ? '메모 있음' : '메모 작성'}
                                                            aria-label={memoContent ? `${formatStudentNameWithParentLast4(student, parentLast4Map)} 메모 확인` : `${formatStudentNameWithParentLast4(student, parentLast4Map)} 메모 작성`}
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
                                    <h3 className="text-xl font-bold text-gray-900">{formatStudentNameWithParentLast4(selectedStudent, parentLast4Map)}</h3>
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
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#334a91] bg-[#f1f4ff] hover:bg-[#eef2ff] rounded-lg border border-[#cfd8ff]"
                                >
                                    <Icon name="edit" className="w-4 h-4" />
                                    메모 작성/수정
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <AttendanceModal
                        parentLast4Map={parentLast4Map}
                        isOpen={isAttendanceModalOpen}
                        onClose={() => setIsAttendanceModalOpen(false)}
                        studentsData={rosterForAttendance}
                        initialAttendance={initialAttendanceForModal}
                        onSave={handleAttendanceSave}
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
