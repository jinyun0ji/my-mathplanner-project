// src/utils/modals/ClassFormModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import {
  WEEKDAY_KEYS,
  formatWeekdayKo,
  isValidTimeHHmm,
  normalizeClassSchedule,
} from '../../utils/helpers';

const DEFAULT_TIME = { start: '19:00', end: '21:00' };

export const ClassFormModal = ({ isOpen, onClose, onSave, classToEdit = null }) => {
  const [name, setName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [grade, setGrade] = useState(2);
  const [schoolType, setSchoolType] = useState('고등학교');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [schedule, setSchedule] = useState({});

  useEffect(() => {
    if (classToEdit) {
      setName(classToEdit.name || '');
      setTeacher(classToEdit.teacher || '');
      setGrade(classToEdit.grade || 2);
      setSchoolType(classToEdit.schoolType || '고등학교');
      setStartDate(classToEdit.startDate || '');
      setEndDate(classToEdit.endDate || '');
      setSchedule(normalizeClassSchedule(classToEdit));
    } else {
      setName('');
      setTeacher('');
      setGrade(2);
      setSchoolType('고등학교');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setSchedule({});
    }
  }, [classToEdit]);

  const selectedDays = useMemo(() => WEEKDAY_KEYS.filter((k) => schedule[k]), [schedule]);
  const hasInvalidTime = useMemo(
    () => selectedDays.some((k) => !isValidTimeHHmm(schedule[k]?.start) || !isValidTimeHHmm(schedule[k]?.end)),
    [schedule, selectedDays],
  );

  const handleDayToggle = (dayKey) => {
    setSchedule((prev) => {
      if (prev[dayKey]) {
        const next = { ...prev };
        delete next[dayKey];
        return next;
      }
      return {
        ...prev,
        [dayKey]: prev[dayKey] || { ...DEFAULT_TIME },
      };
    });
  };

  const handleTimeChange = (dayKey, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || DEFAULT_TIME),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !teacher || !startDate || selectedDays.length === 0 || hasInvalidTime) return;

    const weekdays = selectedDays;
    const first = weekdays[0];
    const legacyStart = first ? schedule[first]?.start : '';
    const legacyEnd = first ? schedule[first]?.end : '';

    const classData = {
      id: classToEdit ? classToEdit.id : null,
      name,
      teacher,
      grade: Number(grade),
      schoolType,
      startDate,
      endDate,
      students: classToEdit ? classToEdit.students : [],
      schedule,
      weekdays,
      dayOfWeek: first || '',
      time: (legacyStart && legacyEnd) ? `${legacyStart}~${legacyEnd}` : '',
      startTime: legacyStart || '',
      endTime: legacyEnd || '',
    };
    try {
      await onSave(classData, !!classToEdit);
      onClose();
    } catch (error) {
      alert('클래스 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={classToEdit ? '클래스 정보 수정' : '새 클래스 등록'} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">클래스 이름*</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">담당 강사*</label>
              <input type="text" value={teacher} onChange={e => setTeacher(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">대상 학년*</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                {[1, 2, 3].map(g => <option key={g} value={g}>고{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">학교 구분</label>
              <input type="text" value={schoolType} onChange={e => setSchoolType(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
            </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">수업 요일/시간*</label>
          <div className="mt-2 space-y-2">
            {WEEKDAY_KEYS.map(dayKey => {
              const checked = Boolean(schedule[dayKey]);
              return (
                <div key={dayKey} className="grid grid-cols-[auto,1fr,1fr] gap-2 items-center">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={checked} onChange={() => handleDayToggle(dayKey)} />
                    {formatWeekdayKo(dayKey)}
                  </label>
                  <input
                    type="time"
                    step="60"
                    value={schedule[dayKey]?.start || ''}
                    onChange={(e) => handleTimeChange(dayKey, 'start', e.target.value)}
                    disabled={!checked}
                    className="rounded-md border-gray-300 shadow-sm p-2 border disabled:bg-gray-100"
                  />
                  <input
                    type="time"
                    step="60"
                    value={schedule[dayKey]?.end || ''}
                    onChange={(e) => handleTimeChange(dayKey, 'end', e.target.value)}
                    disabled={!checked}
                    className="rounded-md border-gray-300 shadow-sm p-2 border disabled:bg-gray-100"
                  />
                </div>
              );
            })}
          </div>
          {hasInvalidTime && <p className="text-xs text-red-600 mt-1">시간 형식은 HH:mm 이어야 합니다.</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">개강일*</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">종강일 (선택)</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
            취소
          </button>
          <button type="submit" disabled={selectedDays.length === 0 || hasInvalidTime} className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition duration-150 shadow-md disabled:opacity-50">
            {classToEdit ? '수정 사항 저장' : '등록하기'}
          </button>
        </div>
      </form>
    </Modal>
  );
};