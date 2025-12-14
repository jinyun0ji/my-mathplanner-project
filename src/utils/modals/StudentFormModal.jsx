// src/utils/modals/StudentFormModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';

export const StudentFormModal = ({ isOpen, onClose, student = null, allClasses, onSave }) => {
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [status, setStatus] = useState('재원생');
  const [classSelections, setClassSelections] = useState([]);
  const [clinicTime, setClinicTime] = useState('');
  const [bookReceived, setBookReceived] = useState(false);
  const [registeredDate, setRegisteredDate] = useState('');

  // ✅ [수정] 필터 제거 (모든 클래스가 나오도록 수정)
  const availableClasses = allClasses;

  useEffect(() => {
    if (student) {
      setName(student.name);
      setSchool(student.school);
      setGrade(student.grade);
      setPhone(student.phone);
      setParentPhone(student.parentPhone);
      setStatus(student.status);
      setClassSelections(student.classes || []);
      setClinicTime(student.clinicTime || '');
      setBookReceived(student.bookReceived || false);
      setRegisteredDate(student.registeredDate || '');
    } else {
      setName('');
      setSchool('');
      setGrade('고1');
      setPhone('');
      setParentPhone('');
      setStatus('재원생');
      setClassSelections([]);
      setClinicTime('');
      setBookReceived(false);
      setRegisteredDate(new Date().toISOString().slice(0, 10));
    }
  }, [student]);

  const handleClassToggle = (classId) => {
    setClassSelections(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !school || !grade) return;

    const studentData = {
      id: student ? student.id : null,
      name,
      school,
      grade,
      phone,
      parentPhone,
      status,
      classes: classSelections,
      clinicTime: clinicTime || null,
      bookReceived,
      registeredDate,
    };
    onSave(studentData, !!student);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={student ? '학생 정보 수정' : '학생 신규 등록'} maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-6 gap-y-4">
        {/* 1열 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">이름*</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">학년*</label>
                <select value={grade} onChange={e => setGrade(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border">
                  {['중1','중2','중3','고1','고2','고3'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">재원 상태*</label>
                <select value={status} onChange={e => setStatus(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border">
                  {['재원생', '상담생', '휴원생', '퇴원생'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">학교*</label>
            <input type="text" value={school} onChange={e => setSchool(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">클리닉 희망 시간</label>
            <input type="time" value={clinicTime || ''} onChange={e => setClinicTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
          </div>
        </div>

        {/* 2열 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">학생 연락처</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">학부모 연락처</label>
            <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">등록일</label>
            <input type="date" value={registeredDate} onChange={e => setRegisteredDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">수강 클래스</label>
            <div className="mt-1 flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md bg-gray-50 min-h-[42px]">
              {availableClasses.length > 0 ? availableClasses.map(cls => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => handleClassToggle(cls.id)}
                  className={`px-3 py-1 text-xs rounded-full border transition duration-150 ${
                    classSelections.includes(cls.id) 
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {cls.name}
                </button>
              )) : <span className="text-xs text-gray-400">등록된 클래스가 없습니다.</span>}
            </div>
          </div>
          <div className="flex items-center pt-2">
            <input type="checkbox" id="bookReceived" checked={bookReceived} onChange={e => setBookReceived(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <label htmlFor="bookReceived" className="ml-2 block text-sm text-gray-900">교재 수령 완료</label>
            <span className="ml-auto text-xs text-gray-500 flex items-center"><Icon name="info" className="w-3 h-3 mr-1" />이 상태는 수납 관리와 연동됩니다.</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="col-span-2 pt-4 border-t flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
            취소
          </button>
          <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition duration-150 shadow-md">
            {student ? '수정 사항 저장' : '등록하기'}
          </button>
        </div>
      </form>
    </Modal>
  );
};