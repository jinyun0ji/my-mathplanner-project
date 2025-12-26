// src/utils/modals/HomeworkAssignmentModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import StaffNotificationFields from '../../components/Shared/StaffNotificationFields';

export const HomeworkAssignmentModal = ({ isOpen, onClose, onSave, classId, assignment = null, students, selectedClass }) => {
  const classStudents = useMemo(() => {
    if (!classId) return [];
    return students.filter((student) => {
      const classIds = Array.isArray(student.classIds)
        ? student.classIds
        : (student.classes || []);
      return classIds.map(String).includes(String(classId));
    });
  }, [students, classId]);
  
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');
  const [book, setBook] = useState('');
  const [assignedStudentIds, setAssignedStudentIds] = useState([]);
  
  // ✅ 변경: 단순 시작/끝 번호 대신 범위 문자열(string) 사용
  const [rangeString, setRangeString] = useState(''); 
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isAssignmentDate, setIsAssignmentDate] = useState(true);
  const [staffNotifyMode, setStaffNotifyMode] = useState('none');
  const [staffNotifyTitle, setStaffNotifyTitle] = useState('');
  const [staffNotifyBody, setStaffNotifyBody] = useState('');
  const [staffNotifyScheduledAt, setStaffNotifyScheduledAt] = useState('');

  const toDatetimeLocal = (value) => {
    if (!value) return '';
    const date = value instanceof Date
      ? value
      : typeof value?.toDate === 'function'
        ? value.toDate()
        : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offset.toISOString().slice(0, 16);
  };

  // 범위 문자열 파싱 함수 (예: "1-5, 8, 10-12" -> [1,2,3,4,5,8,10,11,12])
  const parseRangeString = (str) => {
    if (!str) return [];
    try {
        const parts = str.split(',').map(s => s.trim()).filter(s => s !== '');
        const numbers = new Set();
        
        parts.forEach(part => {
            if (part.includes('-') || part.includes('~')) {
                const [start, end] = part.split(/-|~/).map(Number);
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= end; i++) numbers.add(i);
                }
            } else {
                const num = Number(part);
                if (!isNaN(num)) numbers.add(num);
            }
        });
        return Array.from(numbers).sort((a, b) => a - b);
    } catch (e) {
        return [];
    }
  };

  useEffect(() => {
    if (assignment) {
      setDate(assignment.date);
      setContent(assignment.content);
      setBook(assignment.book || '');
      const assigned = assignment.assignedStudentIds ?? assignment.students;
      if (Array.isArray(assigned) && assigned.length > 0) {
        setAssignedStudentIds(assigned);
      } else {
        setAssignedStudentIds(classStudents.map(student => student.id));
      }
      // 기존 데이터(startQuestion, endQuestion)가 있으면 문자열로 변환, 아니면 저장된 rangeString 사용
      if (assignment.rangeString) {
          setRangeString(assignment.rangeString);
          setTotalQuestions(assignment.totalQuestions);
      } else if (assignment.startQuestion && assignment.endQuestion) {
          setRangeString(`${assignment.startQuestion}-${assignment.endQuestion}`);
          setTotalQuestions(assignment.totalQuestions || (assignment.endQuestion - assignment.startQuestion + 1));
      } else {
          setRangeString('');
          setTotalQuestions(0);
      }
      setIsAssignmentDate(assignment.isAssignmentDate !== undefined ? assignment.isAssignmentDate : true);
      if (assignment.notifyMode === 'staff' && assignment.staffNotification) {
        setStaffNotifyMode(assignment.staffNotification.mode || 'immediate');
        setStaffNotifyTitle(assignment.staffNotification.title || '');
        setStaffNotifyBody(assignment.staffNotification.body || '');
        setStaffNotifyScheduledAt(
          assignment.staffNotification.mode === 'scheduled'
            ? toDatetimeLocal(assignment.staffNotification.scheduledAt)
            : ''
        );
      } else {
        setStaffNotifyMode('none');
        setStaffNotifyTitle('');
        setStaffNotifyBody('');
        setStaffNotifyScheduledAt('');
      }
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setContent('');
      setBook('');
      setAssignedStudentIds(classStudents.map(student => student.id));
      setRangeString('');
      setTotalQuestions(0);
      setIsAssignmentDate(true);
      setStaffNotifyMode('none');
      setStaffNotifyTitle('');
      setStaffNotifyBody('');
      setStaffNotifyScheduledAt('');
    }
  }, [assignment, classStudents]);

  // 범위 문자열이 변할 때마다 총 문제 수 자동 계산
  useEffect(() => {
    const questions = parseRangeString(rangeString);
    setTotalQuestions(questions.length);
  }, [rangeString]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!classId || !date || !content || totalQuestions <= 0) return;
    if (assignedStudentIds.length === 0) {
      alert('과제를 배정할 학생을 최소 1명 선택해주세요.');
      return;
    }

    if (staffNotifyMode !== 'none') {
      if (!staffNotifyTitle.trim() || !staffNotifyBody.trim()) {
        alert('직원 알림 제목과 내용을 입력해주세요.');
        return;
      }
      if (staffNotifyMode === 'scheduled' && !staffNotifyScheduledAt) {
        alert('직원 알림 예약 시간을 선택해주세요.');
        return;
      }
    }

    const staffNotification = staffNotifyMode === 'none'
      ? null
      : {
        mode: staffNotifyMode,
        title: staffNotifyTitle.trim(),
        body: staffNotifyBody.trim(),
        ...(staffNotifyMode === 'scheduled'
          ? { scheduledAt: new Date(staffNotifyScheduledAt) }
          : {}),
      };

    const assignmentData = {
      id: assignment ? assignment.id : null,
      classId,
      date,
      content,
      book,
      rangeString, // ✅ 저장: 입력한 범위 문자열
      totalQuestions,
      assignedStudentIds,
      isAssignmentDate,
      notifyMode: staffNotifyMode === 'none' ? 'system' : 'staff',
      staffNotification,
    };
    try {
      await onSave(assignmentData, !!assignment);
      onClose();
    } catch (error) {
      alert('과제 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
    }
  };

  const handleStaffNotifyModeChange = (value) => {
    setStaffNotifyMode(value);
    if (value !== 'scheduled') {
      setStaffNotifyScheduledAt('');
    }
  };

  const toggleStudent = (studentId) => {
    setAssignedStudentIds(prev => (
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    ));
  };

  const handleSelectAll = () => {
    setAssignedStudentIds(classStudents.map(student => student.id));
  };

  const handleClearAll = () => {
    setAssignedStudentIds([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={assignment ? '과제 수정' : `${selectedClass?.name} 과제 배정`} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">배정일*</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">교재명 (선택)</label>
            <input type="text" value={book} onChange={e => setBook(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="예: RPM 수학(상)" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">과제 내용*</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows="2" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="예: P.10 ~ P.15 오답노트 작성"></textarea>
        </div>
        
        {/* ✅ 문제 범위 입력 UI 변경 */}
        <div className="border p-3 rounded-lg bg-blue-50">
          <h4 className="text-sm font-semibold mb-2 text-gray-700">문제 범위 설정</h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">문제 번호 입력 (쉼표와 하이픈 사용 가능)*</label>
              <input 
                type="text" 
                value={rangeString} 
                onChange={e => setRangeString(e.target.value)} 
                required 
                placeholder="예: 1-10, 15, 20-25" 
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" 
              />
              <p className="text-xs text-gray-500 mt-1">
                연속된 번호는 <span className="font-bold">1-10</span>, 떨어진 번호는 <span className="font-bold">쉼표(,)</span>로 구분하여 입력하세요.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-blue-700">총 {totalQuestions} 문제</p>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-sm font-semibold text-gray-700">학생 선택</h4>
              <p className="text-xs text-gray-500">선택된 학생에게만 과제가 표시됩니다.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" onClick={handleSelectAll} className="text-indigo-600 font-semibold hover:text-indigo-800">
                전체 선택
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={handleClearAll} className="text-gray-500 hover:text-gray-700">
                전체 해제
              </button>
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
            {classStudents.length === 0 ? (
              <p className="text-xs text-gray-400">클래스에 등록된 학생이 없습니다.</p>
            ) : (
              classStudents.map(student => (
                <label key={student.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={assignedStudentIds.includes(student.id)}
                    onChange={() => toggleStudent(student.id)}
                  />
                  <span className="font-medium">{student.name}</span>
                  <span className="text-xs text-gray-400">{student.grade}</span>
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">선택됨: {assignedStudentIds.length}명</p>
        </div>

        <StaffNotificationFields
          mode={staffNotifyMode}
          onModeChange={handleStaffNotifyModeChange}
          title={staffNotifyTitle}
          onTitleChange={setStaffNotifyTitle}
          body={staffNotifyBody}
          onBodyChange={setStaffNotifyBody}
          scheduledAt={staffNotifyScheduledAt}
          onScheduledAtChange={setStaffNotifyScheduledAt}
        />

        <div className="pt-4 border-t flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
            취소
          </button>
          <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition duration-150 shadow-md">
            {assignment ? '과제 수정 저장' : '과제 배정하기'}
          </button>
        </div>
      </form>
    </Modal>
  );
};