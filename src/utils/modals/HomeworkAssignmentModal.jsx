// src/utils/modals/HomeworkAssignmentModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';

export const HomeworkAssignmentModal = ({ isOpen, onClose, onSave, classId, assignment = null, students, selectedClass }) => {
  const classStudents = useMemo(() => students.filter(s => selectedClass?.students.includes(s.id)) || [], [students, selectedClass]);
  
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');
  const [book, setBook] = useState('');
  const [startQuestion, setStartQuestion] = useState(1);
  const [endQuestion, setEndQuestion] = useState(10);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [isAssignmentDate, setIsAssignmentDate] = useState(true);

  useEffect(() => {
    if (assignment) {
      setDate(assignment.date);
      setContent(assignment.content);
      setBook(assignment.book || '');
      setStartQuestion(assignment.startQuestion || 1);
      setEndQuestion(assignment.endQuestion || 10);
      setTotalQuestions(assignment.totalQuestions || 10);
      setIsAssignmentDate(assignment.isAssignmentDate !== undefined ? assignment.isAssignmentDate : true);
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setContent('');
      setBook('');
      setStartQuestion(1);
      setEndQuestion(10);
      setTotalQuestions(10);
      setIsAssignmentDate(true);
    }
  }, [assignment]);

  useEffect(() => {
    // 문제 범위가 바뀌면 총 문제 수 자동 계산
    const start = Number(startQuestion);
    const end = Number(endQuestion);
    if (start > 0 && end >= start) {
      setTotalQuestions(end - start + 1);
    } else if (end < start) {
      setTotalQuestions(0);
    }
  }, [startQuestion, endQuestion]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!classId || !date || !content || totalQuestions <= 0) return;

    const assignmentData = {
      id: assignment ? assignment.id : null,
      classId,
      date,
      content,
      book,
      startQuestion: Number(startQuestion),
      endQuestion: Number(endQuestion),
      totalQuestions,
      students: classStudents.map(s => s.id),
      isAssignmentDate,
    };
    onSave(assignmentData, !!assignment);
    onClose();
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
        
        <div className="border p-3 rounded-lg bg-blue-50">
          <h4 className="text-sm font-semibold mb-2 text-gray-700">문제 범위 및 개수</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">시작 문제 번호*</label>
              <input type="number" value={startQuestion} onChange={e => setStartQuestion(e.target.value)} required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">끝 문제 번호*</label>
              <input type="number" value={endQuestion} onChange={e => setEndQuestion(e.target.value)} required min={startQuestion} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" />
            </div>
            <div className="flex flex-col justify-end">
              <p className="text-sm font-bold text-blue-700">총 {totalQuestions} 문제</p>
            </div>
          </div>
        </div>

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