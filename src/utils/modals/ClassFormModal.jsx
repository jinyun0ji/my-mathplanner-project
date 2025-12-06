// src/utils/modals/ClassFormModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];

export const ClassFormModal = ({ isOpen, onClose, onSave, classToEdit = null }) => {
  const [name, setName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [grade, setGrade] = useState(2);
  const [schoolType, setSchoolType] = useState('고등학교');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [time, setTime] = useState('');

  useEffect(() => {
    if (classToEdit) {
      setName(classToEdit.name);
      setTeacher(classToEdit.teacher);
      setGrade(classToEdit.grade);
      setSchoolType(classToEdit.schoolType);
      setStartDate(classToEdit.startDate);
      setEndDate(classToEdit.endDate);
      setSelectedDays(classToEdit.schedule.days);
      setTime(classToEdit.schedule.time);
    } else {
      setName('');
      setTeacher('');
      setGrade(2);
      setSchoolType('고등학교');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setSelectedDays([]);
      setTime('19:00~21:00');
    }
}, [classToEdit]);

const handleDayToggle = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => daysOfWeek.indexOf(a) - daysOfWeek.indexOf(b))
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !teacher || !startDate || selectedDays.length === 0 || !time) return;

    const classData = {
      id: classToEdit ? classToEdit.id : null,
      name,
      teacher,
      grade: Number(grade),
      schoolType,
      startDate,
      endDate,
      students: classToEdit ? classToEdit.students : [],
      schedule: { days: selectedDays, time },
    };
    onSave(classData, !!classToEdit);
    onClose();
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
              <label className="block text-sm font-medium text-gray-700">수업 시간 (예: 19:00~21:00)*</label>
              <input type="text" value={time} onChange={e => setTime(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
            </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">수업 요일*</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {daysOfWeek.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => handleDayToggle(day)}
                className={`px-4 py-2 text-sm rounded-lg transition duration-150 ${
                  selectedDays.includes(day) 
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
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
          <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition duration-150 shadow-md">
            {classToEdit ? '수정 사항 저장' : '등록하기'}
          </button>
        </div>
      </form>
    </Modal>
  );
};