// src/utils/modals/StudentFormModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { getBirthYearFromGradeLabel, normalizeBirthYear } from '../gradeUtils';
import { formatClassLabel, isClosedClass, sortClassesWithClosedLast } from '../classStatus';

export const StudentFormModal = ({ isOpen, onClose, student = null, allClasses, onSave }) => {
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [status, setStatus] = useState('재원생');
  const [classSelections, setClassSelections] = useState([]);
  const [clinicTime, setClinicTime] = useState('');
  const [bookReceived, setBookReceived] = useState(false);
  const [registeredDate, setRegisteredDate] = useState('');

  // ✅ [수정] 필터 제거 (모든 클래스가 나오도록 수정)
  const availableClasses = sortClassesWithClosedLast(allClasses);

  useEffect(() => {
    if (student) {
      const nextStatus = student.status === 'inactive' ? '재원생' : (student.status || '재원생');
      setName(student.name);
      setSchool(student.school);
      setBirthYear(student.birthYear || getBirthYearFromGradeLabel(student.grade) || '');
      setPhone(student.phone);
      setParentPhone(student.parentPhone);
      setStatus(nextStatus);
      setClassSelections(student.classes || []);
      setClinicTime(student.clinicTime || '');
      setBookReceived(student.bookReceived || false);
      setRegisteredDate(student.registeredDate || '');
      } else {
      setName('');
      setSchool('');
      setBirthYear('');
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
    const normalizedBirthYear = normalizeBirthYear(birthYear);
    const currentYear = new Date().getFullYear();
    if (!name || !school || !normalizedBirthYear || normalizedBirthYear < 1900 || normalizedBirthYear > currentYear) return;
    const studentData = {
      id: student ? student.id : null,
      name,
      school,
      birthYear: normalizedBirthYear,
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
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#455fab] focus:ring-[#455fab] p-2 border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">출생년도*</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={birthYear}
                  onChange={e => setBirthYear(e.target.value)}
                  placeholder="예) 2009"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#455fab] focus:ring-[#455fab] p-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">재원 상태*</label>
                <select value={status} onChange={e => setStatus(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#455fab] focus:ring-[#455fab] p-2 border">
                  <option value="재원생">재원생</option>
                  <option value="휴원">휴원</option>
                </select>
              </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">학교*</label>
            <input type="text" value={school} onChange={e => setSchool(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#455fab] focus:ring-[#455fab] p-2 border" />
          </div>
          {/* <div>
            <label className="block text-sm font-medium text-gray-700">클리닉 희망 시간</label>
            <input type="time" value={clinicTime || ''} onChange={e => setClinicTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#455fab] focus:ring-[#455fab] p-2 border" />
          </div> */}
        </div>

        {/* 2열 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">학생 연락처</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#455fab] focus:ring-[#455fab] p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">학부모 연락처</label>
            <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#455fab] focus:ring-[#455fab] p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">등록일</label>
            <input type="date" value={registeredDate} onChange={e => setRegisteredDate(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#455fab] focus:ring-[#455fab] p-2 border" />
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
                      ? 'bg-[#455fab] text-white border-[#334a91] shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {formatClassLabel(cls)}
                  {isClosedClass(cls) && (
                    <span className="ml-1 rounded bg-gray-200 px-1 text-[10px] text-gray-600">종강</span>
                  )}
                </button>
              )) : <span className="text-xs text-gray-400">등록된 클래스가 없습니다.</span>}
            </div>
          </div>
          {/* <div className="flex items-center pt-2">
            <input type="checkbox" id="bookReceived" checked={bookReceived} onChange={e => setBookReceived(e.target.checked)} className="h-4 w-4 text-[#455fab] border-gray-300 rounded focus:ring-[#455fab]" />
            <label htmlFor="bookReceived" className="ml-2 block text-sm text-gray-900">교재 수령 완료</label>
            <span className="ml-auto text-xs text-gray-500 flex items-center"><Icon name="info" className="w-3 h-3 mr-1" />이 상태는 수납 관리와 연동됩니다.</span>
          </div> */}
        </div>

        {/* 버튼 */}
        <div className="col-span-2 pt-4 border-t flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
            취소
          </button>
          <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#455fab] hover:bg-[#3b5198] transition duration-150 shadow-md">
            {student ? '수정 사항 저장' : '등록하기'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
