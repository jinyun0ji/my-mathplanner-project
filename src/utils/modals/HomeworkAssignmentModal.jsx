// src/utils/modals/HomeworkAssignmentModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';

export const HomeworkAssignmentModal = ({ isOpen, onClose, onSave, classId, assignment = null, students, selectedClass }) => {
  const classStudents = useMemo(() => students.filter(s => selectedClass?.students.includes(s.id)) || [], [students, selectedClass]);
  
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');
  const [book, setBook] = useState('');
  
  // ✅ 변경: 단순 시작/끝 번호 대신 범위 문자열(string) 사용
  const [rangeString, setRangeString] = useState(''); 
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isAssignmentDate, setIsAssignmentDate] = useState(true);

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
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setContent('');
      setBook('');
      setRangeString('');
      setTotalQuestions(0);
      setIsAssignmentDate(true);
    }
  }, [assignment]);

  // 범위 문자열이 변할 때마다 총 문제 수 자동 계산
  useEffect(() => {
    const questions = parseRangeString(rangeString);
    setTotalQuestions(questions.length);
  }, [rangeString]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!classId || !date || !content || totalQuestions <= 0) return;

    const assignmentData = {
      id: assignment ? assignment.id : null,
      classId,
      date,
      content,
      book,
      rangeString, // ✅ 저장: 입력한 범위 문자열
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