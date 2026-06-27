import React, { useEffect, useMemo, useState } from 'react';
import StudentHome from '../StudentHome';
import ParentHome from '../ParentHome';
import ParentContext from '../../parent/ParentContext';
import { getStudentGradeLabel } from '../../utils/gradeUtils';
import { db } from '../../firebase/client';
import { loadViewerDataOnce } from '../../data/firestoreSync';
import { ROLE } from '../../constants/roles';

const countStudentClasses = (student, classes = []) => {
  const ids = new Set([...(student?.classes || []), ...(student?.classIds || [])].map(String));
  return classes.filter((cls) => ids.has(String(cls.id)) || (cls.students || []).map(String).includes(String(student.id))).length;
};

const isExcludedFromMasterView = (student = {}) => {
  const status = String(student?.status || '').trim().toLowerCase();
  return student?.role !== 'student'
    || student?.active === false
    || student?.deletion_requested === true
    || student?.deletionRequested === true
    || status === 'withdrawn'
    || status === 'deletion_requested';
};

const getStudentStatusLabel = (student = {}) => {
  if (student?.active === false) return '비활성';
  if (student?.deletion_requested || student?.deletionRequested || String(student?.status || '').toLowerCase() === 'deletion_requested') return '탈퇴 요청';
  if (String(student?.status || '').toLowerCase() === 'withdrawn') return '퇴원';
  return student?.status || '재원';
};

const MasterBanner = ({ mode }) => (
  <div className="sticky top-0 z-50 bg-amber-100 border border-amber-300 text-amber-900 px-4 py-2 text-sm font-semibold rounded-lg mb-3">
    {mode === 'parent'
      ? '관리자 마스터뷰로 보고 있습니다. 실제 학부모 계정이 아닙니다.'
      : '관리자 마스터뷰로 보고 있습니다. 실제 학생 계정이 아닙니다.'}
  </div>
);

export default function MasterViewPage({
  students = [], classes = [], userId, homeworkAssignments = [], homeworkResults = {},
  attendanceLogs = [], lessonLogs = [], notices = [], tests = [], grades = {}, classTestStats = {},
  videoProgress = {}, videoMemos = {}, externalSchedules = [], clinicLogs = [], closures = [], lessonReports = [],
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [previewMode, setPreviewMode] = useState('student');

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = students.filter((student) => !isExcludedFromMasterView(student)).slice(0, 800);
    if (!term) return base;
    return base.filter((student) => [student.name, student.school, getStudentGradeLabel(student), student.grade, student.phone, student.phoneNumber, student.parentPhone]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [students, searchTerm]);

  const selectedStudent = useMemo(() => students.filter((student) => !isExcludedFromMasterView(student)).find((student) => String(student.id) === String(selectedStudentId)) || null, [students, selectedStudentId]);
  const [previewData, setPreviewData] = useState({
    students: [],
    classes: [],
    homeworkAssignments: [],
    homeworkResults: {},
    attendanceLogs: [],
    lessonLogs: [],
    notices: [],
    tests: [],
    grades: {},
    classTestStats: {},
    videoProgress: [],
    videoMemos: {},
    externalSchedules: [],
    clinicLogs: [],
    closures: [],
    lessonReports: [],
    loading: false,
    error: '',
  });

  useEffect(() => {
    if (!selectedStudent?.id) {
      setPreviewData((prev) => ({ ...prev, students: [], loading: false, error: '' }));
      return undefined;
    }

    const state = { cancelled: false };
    const selectedAuthUid = selectedStudent.authUid || selectedStudent.userUid || selectedStudent.uid || '';
    setPreviewData((prev) => ({
      ...prev,
      students: [selectedStudent],
      classes: [],
      homeworkAssignments: [],
      homeworkResults: {},
      attendanceLogs: [],
      lessonLogs: [],
      notices: [],
      tests: [],
      grades: {},
      classTestStats: {},
      videoProgress: [],
      videoMemos: {},
      externalSchedules: [],
      clinicLogs: [],
      closures: [],
      lessonReports: [],
      loading: true,
      error: '',
    }));

    loadViewerDataOnce({
      db,
      isLoggedIn: true,
      userRole: ROLE.STUDENT,
      userId: selectedAuthUid,
      studentIds: [selectedStudent.id],
      activeStudentId: selectedStudent.id,
      setStudents: (value) => setPreviewData((prev) => ({ ...prev, students: Array.isArray(value) && value.length ? value : [selectedStudent] })),
      setClasses: (value) => setPreviewData((prev) => ({ ...prev, classes: value || [] })),
      setLessonLogs: (value) => setPreviewData((prev) => ({ ...prev, lessonLogs: value || [] })),
      setAttendanceLogs: (value) => setPreviewData((prev) => ({ ...prev, attendanceLogs: value || [] })),
      setClinicLogs: (value) => setPreviewData((prev) => ({ ...prev, clinicLogs: value || [] })),
      setHomeworkAssignments: (value) => setPreviewData((prev) => ({ ...prev, homeworkAssignments: value || [] })),
      setAnnouncements: (value) => setPreviewData((prev) => ({ ...prev, notices: value || [] })),
      setTests: (value) => setPreviewData((prev) => ({ ...prev, tests: value || [] })),
      setVideoProgress: (value) => setPreviewData((prev) => ({ ...prev, videoProgress: value || [] })),
      setVideoMemos: (value) => setPreviewData((prev) => ({ ...prev, videoMemos: value || {} })),
      setExternalSchedules: (value) => setPreviewData((prev) => ({ ...prev, externalSchedules: value || [] })),
      setHomeworkResults: (value) => setPreviewData((prev) => ({ ...prev, homeworkResults: value || {} })),
      setGrades: (value) => setPreviewData((prev) => ({ ...prev, grades: value || {} })),
      setClosures: (value) => setPreviewData((prev) => ({ ...prev, closures: value || [] })),
      setClassTestStats: (value) => setPreviewData((prev) => ({ ...prev, classTestStats: value || {} })),
      setLessonReports: (value) => setPreviewData((prev) => ({ ...prev, lessonReports: value || [] })),
      isCancelled: () => state.cancelled,
    })
      .catch((error) => {
        console.error('[masterView] selected student viewer data load failed', error);
        if (!state.cancelled) setPreviewData((prev) => ({ ...prev, error: '선택 학생 데이터를 불러오지 못했습니다.' }));
      })
      .finally(() => {
        if (!state.cancelled) setPreviewData((prev) => ({ ...prev, loading: false }));
      });

    return () => { state.cancelled = true; };
  }, [selectedStudent]);

  const previewStudents = previewData.students.length ? previewData.students : (selectedStudent ? [selectedStudent] : []);
  const previewStudent = previewStudents[0] || selectedStudent;
  const previewStudentAuthUid = previewStudent?.authUid || previewStudent?.userUid || previewStudent?.uid || '';
  const previewClasses = previewData.classes.length ? previewData.classes : classes.filter((cls) => countStudentClasses(selectedStudent || {}, [cls]) > 0);

  const blockPreviewMutation = (event) => {
    const target = event.target?.closest?.('button, a, input, select, textarea');
    if (!target) return;

    const tag = target.tagName?.toLowerCase();
    const type = String(target.getAttribute('type') || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      if (['checkbox', 'radio', 'file', 'submit'].includes(type) || tag !== 'input') {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const actionText = [target.innerText, target.getAttribute('aria-label'), target.getAttribute('title')]
      .filter(Boolean)
      .join(' ')
      .trim();
    const isMutationAction = /(저장|삭제|수정|등록|전송|제출|완료|추가|예약|취소|로그아웃|변경|업데이트|작성|보내기|save|delete|edit|submit|send|update|add|register)/i.test(actionText);
    if (isMutationAction) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const blockPreviewSubmit = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const blockPreviewInputChange = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const parentContextValue = useMemo(() => ({
    activeStudentId: selectedStudentId || null,
    studentIds: selectedStudentId ? [selectedStudentId] : [],
    loading: false,
    setActiveStudentId: async () => {},
  }), [selectedStudentId]);

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
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-gray-900">{student.name || '이름 없음'}</div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{getStudentStatusLabel(student)}</span>
              </div>
              <div className="text-xs text-gray-500">{student.school || '학교 정보 없음'} · {getStudentGradeLabel(student)} · 수강 중 클래스 {countStudentClasses(student, classes)}개</div>
            </button>
          ))}
        </div>
      </section>
      {selectedStudent && (
        <section className="bg-white rounded-2xl border border-gray-100 p-3">
          <MasterBanner mode={previewMode} />
          {previewData.loading && <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">선택 학생 데이터를 불러오는 중입니다.</div>}
          {previewData.error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{previewData.error}</div>}
          <div
            className="relative border rounded-2xl overflow-hidden bg-gray-50 master-preview-readonly"
            onClickCapture={blockPreviewMutation}
            onSubmitCapture={blockPreviewSubmit}
            onChangeCapture={blockPreviewInputChange}
            onInputCapture={blockPreviewInputChange}
            onKeyDownCapture={blockPreviewInputChange}
          >
            <style>{`.master-preview-readonly input, .master-preview-readonly textarea, .master-preview-readonly select { caret-color: transparent; }`}</style>
            <div className="select-none h-[75vh] overflow-y-auto">
              {previewMode === 'student' ? (
                <StudentHome student={previewStudent} studentId={previewStudent.id} userId={previewStudentAuthUid} students={previewStudents} classes={previewClasses} homeworkAssignments={previewData.homeworkAssignments} homeworkResults={previewData.homeworkResults} attendanceLogs={previewData.attendanceLogs} lessonLogs={previewData.lessonLogs} notices={previewData.notices} tests={previewData.tests} grades={previewData.grades} classTestStats={previewData.classTestStats} videoProgress={previewData.videoProgress} videoMemos={previewData.videoMemos} onSaveVideoProgress={noop} onAddMemo={noop} onUpdateMemo={noop} onDeleteMemo={noop} externalSchedules={previewData.externalSchedules} onSaveExternalSchedule={noop} onDeleteExternalSchedule={noop} clinicLogs={previewData.clinicLogs} closures={previewData.closures} lessonReports={previewData.lessonReports} onUpdateStudent={noop} onLogout={noop} masterView masterViewStudentId={previewStudent.id} masterViewStudentAuthUid={previewStudentAuthUid} readOnly embedded />
              ) : (
                <ParentContext.Provider value={parentContextValue}>
                  <ParentHome userId={previewStudentAuthUid} students={previewStudents} classes={previewClasses} homeworkAssignments={previewData.homeworkAssignments} homeworkResults={previewData.homeworkResults} attendanceLogs={previewData.attendanceLogs} lessonLogs={previewData.lessonLogs} notices={previewData.notices} tests={previewData.tests} grades={previewData.grades} classTestStats={previewData.classTestStats} videoProgress={previewData.videoProgress} clinicLogs={previewData.clinicLogs} lessonReports={previewData.lessonReports} onLogout={noop} externalSchedules={previewData.externalSchedules} onSaveExternalSchedule={noop} onDeleteExternalSchedule={noop} closures={previewData.closures} masterView masterViewStudentId={previewStudent.id} masterViewStudentAuthUid={previewStudentAuthUid} readOnly embedded />
                </ParentContext.Provider>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
