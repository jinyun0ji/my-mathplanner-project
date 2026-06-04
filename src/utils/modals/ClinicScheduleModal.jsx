// src/utils/modals/ClinicScheduleModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { buildStudentParentPhoneLast4Map } from '../parentPhone';
import StudentNameWithParentLast4 from '../../components/common/StudentNameWithParentLast4';

export const ClinicScheduleModal = ({ isOpen, onClose, onSave, students, parents = [], defaultDate, clinicLogs, classes }) => {
    const [date, setDate] = useState(defaultDate);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [reservationMode, setReservationMode] = useState('byDate');
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [selectedSlots, setSelectedSlots] = useState({});
    const [plannedTime, setPlannedTime] = useState('14:00');
    const [slotDate, setSlotDate] = useState(defaultDate);
    const [slotTime, setSlotTime] = useState('14:00');
    const [studentQuery, setStudentQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            setDate(defaultDate);
            setSelectedStudentIds([]);
            setPlannedTime('14:00');
            setReservationMode('byDate');
            setSelectedStudentId(null);
            setSelectedSlots({});
            setSlotDate(defaultDate);
            setSlotTime('14:00');
            setStudentQuery('');
        }
    }, [isOpen, defaultDate]);

    const parentLast4Map = useMemo(
        () => buildStudentParentPhoneLast4Map(students, parents),
        [students, parents],
    );

    const normalizedClinicLogs = useMemo(
        () => Array.isArray(clinicLogs) ? clinicLogs : [],
        [clinicLogs],
    );

    const sortByNameKo = (arr) =>
        [...(arr || [])].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ko'));

    const getStudentClassIds = (student) => {
        const rawIds = Array.isArray(student?.classes)
            ? student.classes
            : (Array.isArray(student?.classIds) ? student.classIds : []);
        return rawIds.map((id) => String(id));
    };

    const getClassNameString = (student) => {
        const classIds = getStudentClassIds(student);
        if (classIds.length === 0) return '클래스 미정';

        const classNames = classIds
            .map(clsId => classes?.find(c => String(c.id) === String(clsId))?.name)
            .filter(Boolean);

        return classNames.length > 0 ? classNames.join(', ') : '클래스 미정';
    };

    // ✅ [수정] 그룹핑 기준: 클래스명만 사용
    const groupedStudents = useMemo(() => {
        const q = studentQuery.trim().toLowerCase();
        const filteredStudents = q
            ? students.filter((s) => String(s?.name || '').toLowerCase().includes(q))
            : students;

        const classList = Array.isArray(classes) ? classes : [];
        const classGroups = classList.map((cls) => {
            const groupStudents = filteredStudents.filter((student) => getStudentClassIds(student).includes(String(cls.id)));
            return {
                key: String(cls.id),
                name: cls.name,
                students: sortByNameKo(groupStudents),
            };
        }).filter((group) => group.students.length > 0);
        const noClassStudents = sortByNameKo(filteredStudents.filter((student) => getStudentClassIds(student).length === 0));
        return [
            ...classGroups,
            ...(noClassStudents.length > 0
                ? [{ key: 'no-class', name: '수강 없음', students: noClassStudents }]
                : []),
        ];
    }, [students, classes, studentQuery]);

    const hasReservationSameDate = (sid, targetDate) => normalizedClinicLogs.some((r) => {
        const status = String(r?.status || '').toLowerCase();
        return String(r?.studentId) === String(sid)
            && String(r?.date) === String(targetDate)
            && ['reserved', 'booked', 'pending'].includes(status);
    });

    const handleStudentToggle = (id) => {
        setSelectedStudentIds(prev =>
            prev.includes(id)
                ? prev.filter(sId => sId !== id)
                : [...prev, id]
        );
    };

    const toggleSlot = (slotKey) => {
        setSelectedSlots(prev => ({ ...prev, [slotKey]: !prev[slotKey] }));
    };

    const handleAddSlot = () => {
        if (!slotDate || !slotTime) {
            alert('예약할 날짜와 시간을 선택하세요.');
            return;
        }
        const key = `${slotDate}_${slotTime}`;
        setSelectedSlots(prev => ({ ...prev, [key]: true }));
    };

    const handleRemoveSlot = (slotKey) => {
        setSelectedSlots(prev => {
            const next = { ...prev };
            delete next[slotKey];
            return next;
        });
    };

    const sortedSlotKeys = useMemo(() => {
        return Object.keys(selectedSlots).sort((a, b) => {
            const [aDate, aTime] = a.split('_');
            const [bDate, bTime] = b.split('_');
            if (aDate !== bDate) return aDate.localeCompare(bDate);
            return aTime.localeCompare(bTime);
        });
    }, [selectedSlots]);

    const pickedSlots = useMemo(
        () => Object.keys(selectedSlots).filter((key) => selectedSlots[key]),
        [selectedSlots],
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (reservationMode === 'byDate') {
            if (selectedStudentIds.length === 0 || !date) {
                alert("날짜와 최소 한 명 이상의 학생을 선택하세요.");
                return;
            }

            const duplicates = [];
            const uniqueStudentIds = [];

            selectedStudentIds.forEach(sId => {
                const isDuplicate = hasReservationSameDate(sId, date);
                if (isDuplicate) {
                    const student = students.find(s => s.id === sId);
                    const className = getClassNameString(student);
                    duplicates.push(`${student ? student.name : 'Unknown'} (${className})`);
                } else {
                    uniqueStudentIds.push(sId);
                }
            });

            if (duplicates.length > 0) {
                alert(`다음 학생들은 이미 ${date}에 예약이 되어 있어 제외됩니다:\n${duplicates.join('\n')}`);
            }

            if (uniqueStudentIds.length === 0) {
                if (duplicates.length === 0) alert("등록할 학생이 없습니다.");
                return;
            }

            const newLogs = uniqueStudentIds.map(sId => {
                const student = students.find(s => s.id === sId);
                return {
                    id: null,
                    studentId: sId,
                    studentName: student ? student.name : 'Unknown',
                    date,
                    plannedTime,
                    checkIn: '',
                    checkOut: '',
                    comment: '',
                    tutor: '',
                    notificationSent: false,
                    status: 'pending',
                };
            });

            newLogs.forEach(log => onSave(log, false));

            onClose();
            return;
        }

        if (!selectedStudentId) {
            alert('학생을 선택하세요.');
            return;
        }

        if (!pickedSlots.length) {
            alert('예약할 날짜/시간을 선택하세요.');
            return;
        }

        const duplicates = [];
        const uniqueSlots = [];

        pickedSlots.forEach((slotKey) => {
            const [slotDateValue, slotTimeValue] = slotKey.split('_');
            const isDuplicate = hasReservationSameDate(selectedStudentId, slotDateValue);
            if (isDuplicate) {
                duplicates.push(`${slotDateValue} ${slotTimeValue}`);
            } else {
                uniqueSlots.push({ date: slotDateValue, time: slotTimeValue });
            }
        });

        if (duplicates.length > 0) {
            alert(`다음 일정은 이미 예약되어 있어 제외됩니다:\n${duplicates.join('\n')}`);
        }

        if (uniqueSlots.length === 0) {
            if (duplicates.length === 0) alert('등록할 일정이 없습니다.');
            return;
        }

        const student = students.find((s) => String(s.id) === String(selectedStudentId));
        const newLogs = uniqueSlots.map((slot) => ({
            id: null,
            studentId: selectedStudentId,
            studentName: student ? student.name : 'Unknown',
            date: slot.date,
            plannedTime: slot.time,
            checkIn: '',
            checkOut: '',
            comment: '',
            tutor: '',
            notificationSent: false,
            status: 'pending',
        }));

        newLogs.forEach((log) => onSave(log, false));
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="클리닉 예약" maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2 mb-2">
                    <button
                        type="button"
                        className={`px-3 py-1 rounded-lg text-sm font-semibold border ${reservationMode === 'byDate' ? 'bg-[#455fab] text-white border-[#455fab]' : 'bg-white text-gray-700 border-gray-200'}`}
                        onClick={() => setReservationMode('byDate')}
                    >
                        날짜 기준
                    </button>
                    <button
                        type="button"
                        className={`px-3 py-1 rounded-lg text-sm font-semibold border ${reservationMode === 'byStudent' ? 'bg-[#455fab] text-white border-[#455fab]' : 'bg-white text-gray-700 border-gray-200'}`}
                        onClick={() => setReservationMode('byStudent')}
                    >
                        학생 기준
                    </button>
                </div>

                {reservationMode === 'byDate' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">날짜</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                className="w-full border rounded-md p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">참석 예정 시간 (선택)</label>
                            <input
                                type="time"
                                value={plannedTime}
                                onChange={(e) => setPlannedTime(e.target.value)}
                                className="w-full border rounded-md p-2"
                            />
                            <p className='text-xs text-gray-500 mt-1'>체크된 학생들의 기본 참석 예정 시간입니다.</p>
                        </div>
                    </div>
                    ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">예약 날짜</label>
                                <input
                                    type="date"
                                    value={slotDate || ''}
                                    onChange={(e) => setSlotDate(e.target.value)}
                                    className="w-full border rounded-md p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">예약 시간</label>
                                <input
                                    type="time"
                                    value={slotTime}
                                    onChange={(e) => setSlotTime(e.target.value)}
                                    className="w-full border rounded-md p-2"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleAddSlot}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#455fab] text-white hover:bg-[#3b5198]"
                            >
                                슬롯 추가
                            </button>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            {sortedSlotKeys.length > 0 ? (
                                <div className="space-y-2">
                                    {sortedSlotKeys.map((slotKey) => {
                                        const [slotDateValue, slotTimeValue] = slotKey.split('_');
                                        return (
                                            <div
                                                key={slotKey}
                                                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm"
                                            >
                                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(selectedSlots[slotKey])}
                                                        onChange={() => toggleSlot(slotKey)}
                                                        className="rounded text-[#455fab] focus:ring-[#455fab]"
                                                    />
                                                    <span className="font-semibold">{slotDateValue}</span>
                                                    <span className="text-gray-500 font-mono">{slotTimeValue}</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSlot(slotKey)}
                                                    className="text-xs text-gray-400 hover:text-red-500"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500">추가된 슬롯이 없습니다.</p>
                            )}
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">클리닉 참석 학생 선택* (총 {students.length}명)</label>
                    <input
                        value={studentQuery}
                        onChange={(e) => setStudentQuery(e.target.value)}
                        className="mb-2 w-full border rounded-md p-2"
                        placeholder="학생 이름 검색"
                    />
                    <div className="border rounded-md p-3 max-h-80 overflow-y-auto bg-gray-50">
                        {groupedStudents.map((group) => (
                            <div key={group.key} className="mb-4 border-b pb-3 last:border-b-0">
                                <h5 className="text-sm font-bold text-[#334a91] mb-2 p-1 border-l-4 border-[#455fab] pl-2 bg-white rounded-sm shadow-sm">
                                    {group.name} ({group.students.length}명)
                                </h5>
                                <div className="grid grid-cols-3 gap-2">
                                    {group.students.map(s => (
                                        (() => {
                                            const duplicateForDate = reservationMode === 'byDate' && date
                                                ? hasReservationSameDate(s.id, date)
                                                : false;
                                            return (
                                        <div
                                            key={s.id}
                                            className={`flex items-start p-2 rounded-lg transition border ${duplicateForDate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${
                                                reservationMode === 'byDate'
                                                    ? (selectedStudentIds.includes(s.id) ? 'bg-[#eef2ff] border-[#455fab] shadow-sm' : 'bg-white hover:bg-gray-100')
                                                    : (String(selectedStudentId) === String(s.id) ? 'bg-[#eef2ff] border-[#455fab] shadow-sm' : 'bg-white hover:bg-gray-100')
                                            }`}
                                            onClick={() => {
                                                if (duplicateForDate) return;
                                                if (reservationMode === 'byDate') {
                                                    handleStudentToggle(s.id);
                                                } else {
                                                    setSelectedStudentId(s.id);
                                                }
                                            }}
                                        >
                                            {reservationMode === 'byDate' ? (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStudentIds.includes(s.id)}
                                                    onChange={() => {}}
                                                    className="mt-1 rounded text-[#455fab] focus:ring-[#455fab] h-4 w-4 mr-2 flex-shrink-0"
                                                />
                                            ) : (
                                                <input
                                                    type="radio"
                                                    checked={String(selectedStudentId) === String(s.id)}
                                                    onChange={() => {}}
                                                    className="mt-1 text-[#455fab] focus:ring-[#455fab] h-4 w-4 mr-2 flex-shrink-0"
                                                />
                                            )}
                                            <div className='flex flex-col text-sm'>
                                                <StudentNameWithParentLast4
                                                    student={s}
                                                    parentLast4Map={parentLast4Map}
                                                    className="font-bold text-gray-900"
                                                />
                                                {duplicateForDate && <span className="text-[11px] text-red-500">같은 날짜 예약 있음</span>}
                                            </div>
                                        </div>
                                        );
                                        })()
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className='text-xs text-gray-500 mt-1'>
                        {reservationMode === 'byDate'
                            ? '체크된 모든 학생에 대해 일정이 등록됩니다.'
                            : '선택한 학생에게 여러 일정이 등록됩니다.'}
                    </p>
                </div>

                <div className="pt-4 flex justify-end space-x-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">취소</button>
                    <button type="submit" className="px-4 py-2 bg-[#455fab] text-white rounded-lg text-sm font-bold hover:bg-[#3b5198]">
                        {reservationMode === 'byDate' ? `총 ${selectedStudentIds.length}명 예약` : `${pickedSlots.length}건 예약`}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
