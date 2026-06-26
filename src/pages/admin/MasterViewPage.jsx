import React, { useMemo, useState } from 'react';
import StudentHome from '../StudentHome';
import ParentHome from '../ParentHome';
import ParentContext from '../../parent/ParentContext';
import { getStudentGradeLabel } from '../../utils/gradeUtils';

const countStudentClasses = (student, classes = []) => {
  const ids = new Set([...(student?.classes || []), ...(student?.classIds || [])].map(String));
  return classes.filter((cls) => ids.has(String(cls.id)) || (cls.students || []).map(String).includes(String(student.id))).length;
};

const MasterBanner = () => (
  <div className="sticky top-0 z-50 bg-amber-100 border border-amber-300 text-amber-900 px-4 py-2 text-sm font-semibold rounded-lg mb-3">
    관리자 마스터뷰로 보고 있습니다. 실제 학생/학부모 계정이 아닙니다.
  </div>
);

export default function MasterViewPage({ students = [], classes = [], userId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [previewMode, setPreviewMode] = useState('student');

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = students.slice(0, 800);
    if (!term) return base;
    return base.filter((student) => [student.name, student.school, student.grade, student.phone, student.phoneNumber, student.parentPhone]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [students, searchTerm]);

  const selectedStudent = useMemo(() => students.find((student) => String(student.id) === String(selectedStudentId)) || null, [students, selectedStudentId]);
  const selectedClasses = useMemo(() => selectedStudent ? classes.filter((cls) => {
    const ids = new Set([...(selectedStudent.classes || []), ...(selectedStudent.classIds || [])].map(String));
    return ids.has(String(cls.id)) || (cls.students || []).map(String).includes(String(selectedStudent.id));
  }) : [], [classes, selectedStudent]);
  const previewStudents = selectedStudent ? [selectedStudent] : [];

  const parentContextValue = useMemo(() => ({
    activeStudentId: selectedStudentId || null,
    studentIds: selectedStudentId ? [selectedStudentId] : [],
    loading: false,
    setActiveStudentId: async () => {},
  }), [selectedStudentId]);

  const emptyMap = {};
  const noop = async () => undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">마스터뷰</h1>
        <p className="mt-1 text-sm text-gray-500">관리자 전용 학생/학부모 화면 확인 도구입니다.</p>
      </div>
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="학생 이름, 학교, 학년, 전화번호 검색" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setPreviewMode('student')} className={`px-3 py-2 rounded-lg text-sm ${previewMode === 'student' ? 'bg-[#455fab] text-white' : 'bg-gray-100'}`}>학생 화면으로 보기</button>
          <button type="button" onClick={() => setPreviewMode('parent')} className={`px-3 py-2 rounded-lg text-sm ${previewMode === 'parent' ? 'bg-[#455fab] text-white' : 'bg-gray-100'}`}>학부모 화면으로 보기</button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border rounded-xl">
          {filteredStudents.map((student) => (
            <button key={student.id} type="button" onClick={() => setSelectedStudentId(student.id)} className={`w-full text-left px-4 py-3 ${selectedStudentId === student.id ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
              <div className="font-semibold text-gray-900">{student.name || '이름 없음'}</div>
              <div className="text-xs text-gray-500">{student.school || '학교 정보 없음'} · {getStudentGradeLabel(student)} · 수강 중 클래스 {countStudentClasses(student, classes)}개</div>
            </button>
          ))}
        </div>
      </section>
      {selectedStudent && (
        <section className="bg-white rounded-2xl border border-gray-100 p-3">
          <MasterBanner />
          <div className="relative border rounded-2xl overflow-hidden bg-gray-50 master-preview-readonly">
            <style>{`.master-preview-readonly button, .master-preview-readonly input, .master-preview-readonly textarea, .master-preview-readonly select, .master-preview-readonly a { pointer-events: none !important; }`}</style>
            <div className="select-none max-h-[75vh] overflow-y-auto">
              {previewMode === 'student' ? (
                <StudentHome student={selectedStudent} studentId={selectedStudent.id} userId={userId} students={previewStudents} classes={selectedClasses} homeworkAssignments={[]} homeworkResults={emptyMap} attendanceLogs={[]} lessonLogs={[]} notices={[]} tests={[]} grades={emptyMap} classTestStats={emptyMap} videoProgress={emptyMap} videoMemos={emptyMap} onSaveVideoProgress={noop} onAddMemo={noop} onUpdateMemo={noop} onDeleteMemo={noop} externalSchedules={[]} onSaveExternalSchedule={noop} onDeleteExternalSchedule={noop} clinicLogs={[]} closures={[]} lessonReports={[]} onUpdateStudent={noop} onLogout={noop} />
              ) : (
                <ParentContext.Provider value={parentContextValue}>
                  <ParentHome userId={userId} students={previewStudents} classes={selectedClasses} homeworkAssignments={[]} homeworkResults={emptyMap} attendanceLogs={[]} lessonLogs={[]} notices={[]} tests={[]} grades={emptyMap} classTestStats={emptyMap} videoProgress={emptyMap} clinicLogs={[]} lessonReports={[]} onLogout={noop} externalSchedules={[]} onSaveExternalSchedule={noop} onDeleteExternalSchedule={noop} closures={[]} />
                </ParentContext.Provider>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
