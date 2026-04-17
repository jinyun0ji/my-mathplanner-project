import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import useAuth from '../auth/useAuth';
import {
  buildLessonReportId,
  LESSON_REPORT_STATUS,
  summarizeAssignedHomework,
  summarizeHomework,
  summarizeTests,
} from '../domain/lessonReport/lessonReport.service';
import { getLinkedParentAuthUids } from '../utils/parentLinking';
import { filterRosterByWithdrawDate } from '../utils/rosterFilter';
import { hasClassOnDate, isClosedForClass } from '../utils/helpers';

const pad2 = (value) => String(value).padStart(2, '0');

const toYmd = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }

  const dateValue = typeof value?.toDate === 'function' ? value.toDate() : value;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
};

const todayYmd = () => toYmd(new Date());
const resolveClassId = (item) => String(item?.classId || item?.classDocId || item?.class?.id || '');
const resolveLessonLogDate = (item) => toYmd(item?.date || item?.lessonDate || item?.dateKey || item?.createdAt || item?.updatedAt);
const resolveAttendanceDate = (item) => toYmd(item?.date || item?.lessonDate || item?.dateKey || item?.createdAt || item?.updatedAt);
const resolveHomeworkDate = (item) => toYmd(item?.date || item?.assignedDate || item?.lessonDate || item?.createdAt || item?.updatedAt);
const resolveTestDate = (item) => toYmd(item?.date || item?.testDate || item?.lessonDate || item?.createdAt || item?.updatedAt);
const resolveLessonLogProgress = (log) => String(log?.progress || log?.learnedTopics || log?.lessonSummary || log?.topic || '');

const statusLabel = (status) => {
  if (status === LESSON_REPORT_STATUS.SENT) return '발송 완료';
  if (status === LESSON_REPORT_STATUS.DRAFT) return '초안';
  return '미생성';
};

const statusClassName = (status) => {
  if (status === LESSON_REPORT_STATUS.SENT) return 'bg-green-100 text-green-700';
  if (status === LESSON_REPORT_STATUS.DRAFT) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
};

const getStudentClassIds = (student) => {
  if (!student) return [];
  if (Array.isArray(student.classIds)) return student.classIds.map(String);
  if (Array.isArray(student.classes)) return student.classes.map(String);
  return [];
};

export default function LessonReportManagement({
  students = [],
  classes = [],
  lessonLogs = [],
  attendanceLogs = [],
  homeworkAssignments = [],
  tests = [],
  homeworkResults = {},
  grades = {},
  lessonReports = [],
  closures = [],
}) {
  const { studentId: routeStudentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profileDocId } = useAuth();
  
  const preselectedStudentId = String(routeStudentId || searchParams.get('studentId') || '');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [selectedStudentId, setSelectedStudentId] = useState(preselectedStudentId);
  const [draft, setDraft] = useState(null);
  const [draftError, setDraftError] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');

  const availableClasses = useMemo(
    () => (Array.isArray(classes) ? classes.filter((item) => item?.id) : []),
    [classes],
  );

  useEffect(() => {
    if (selectedClassId) return;
    if (availableClasses.length === 0) return;

    const fromStudent = students.find((item) => String(item.id) === preselectedStudentId);
    const preferredClassId = getStudentClassIds(fromStudent)[0];
    setSelectedClassId(String(preferredClassId || availableClasses[0].id));
  }, [availableClasses, preselectedStudentId, selectedClassId, students]);

  const selectedClass = useMemo(
    () => availableClasses.find((item) => String(item.id) === String(selectedClassId)) || null,
    [availableClasses, selectedClassId],
  );

  const isSelectedDateLessonDay = useMemo(() => {
    if (!selectedClass || !selectedDate) return true;
    if (!hasClassOnDate(selectedClass, selectedDate)) return false;
    if (isClosedForClass(selectedDate, selectedClass.id, closures)) return false;
    return true;
  }, [closures, selectedClass, selectedDate]);

  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    if (!isSelectedDateLessonDay) return [];
    const baseStudents = students
      .filter((student) => getStudentClassIds(student).includes(String(selectedClassId)));
    return filterRosterByWithdrawDate(baseStudents, selectedClassId, selectedDate)
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ko'));
  }, [isSelectedDateLessonDay, selectedClassId, selectedDate, students]);

  useEffect(() => {
    if (!selectedStudentId) return;
    if (!classStudents.some((student) => String(student.id) === String(selectedStudentId))) {
      setSelectedStudentId('');
    }
  }, [classStudents, selectedStudentId]);

  useEffect(() => {
    if (selectedStudentId || classStudents.length === 0) return;
    setSelectedStudentId(String(classStudents[0].id));
  }, [classStudents, selectedStudentId]);

  const reportMap = useMemo(() => {
    const map = new Map();
    lessonReports.forEach((report) => {
      const key = buildLessonReportId({
        studentId: report.studentId,
        classId: report.classId,
        lessonDate: toYmd(report.lessonDate),
      });
      if (key) map.set(key, report);
    });
    return map;
  }, [lessonReports]);

  const selectedLessonDate = toYmd(draft?.lessonDate || selectedDate || '');
  const selectedDraftClassId = String(draft?.classId || selectedClassId || '');
  const selectedDraftStudentId = String(draft?.studentId || selectedStudentId || '');

  const toDateDistance = (a, b) => {
    if (!a || !b) return Number.MAX_SAFE_INTEGER;
    const aTime = new Date(`${a}T00:00:00`).getTime();
    const bTime = new Date(`${b}T00:00:00`).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return Number.MAX_SAFE_INTEGER;
    return Math.abs(aTime - bTime);
  };

  const candidateLessonLogs = useMemo(() => (lessonLogs || []).filter((log) => (
    resolveClassId(log) === selectedDraftClassId
    && resolveLessonLogDate(log) === selectedLessonDate
  )), [lessonLogs, selectedDraftClassId, selectedLessonDate]);

  const currentLessonLog = useMemo(
    () => candidateLessonLogs[0] || null,
    [candidateLessonLogs],
  );

  const currentAutoFilledLearnedTopics = useMemo(
    () => resolveLessonLogProgress(currentLessonLog),
    [currentLessonLog],
  );

  const candidateHomeworkAssignments = useMemo(() => (homeworkAssignments || [])
    .filter((item) => resolveClassId(item) === selectedDraftClassId)
    .map((item) => {
      const targets = [
        ...(Array.isArray(item.targetStudents) ? item.targetStudents : []),
        ...(Array.isArray(item.assignedStudentIds) ? item.assignedStudentIds : []),
        ...(Array.isArray(item.students) ? item.students : []),
      ].map(String);
      const isTargeted = targets.length === 0 || targets.includes(selectedDraftStudentId);
      return {
        ...item,
        __candidate_isTargeted: isTargeted,
        __candidate_distance: toDateDistance(resolveHomeworkDate(item), selectedLessonDate),
      };
    })
    .filter((item) => item.__candidate_isTargeted)
    .sort((a, b) => {
      if (a.__candidate_distance !== b.__candidate_distance) return a.__candidate_distance - b.__candidate_distance;
      return String(resolveHomeworkDate(b) || '').localeCompare(String(resolveHomeworkDate(a) || ''));
    }), [homeworkAssignments, selectedDraftClassId, selectedDraftStudentId, selectedLessonDate]);

  const selectableHomework = candidateHomeworkAssignments;

  const candidateTests = useMemo(() => {
    if (!selectedDraftClassId) return [];
    return (tests || [])
      .filter((item) => resolveClassId(item) === selectedDraftClassId)
      .map((item) => {
        const grade = grades?.[selectedDraftStudentId]?.[item.id] || grades?.[String(selectedDraftStudentId)]?.[item.id] || null;
        return {
          ...item,
          __sort_hasGrade: Boolean(grade),
          __sort_distance: toDateDistance(resolveTestDate(item), selectedLessonDate),
        };
      })
      .sort((a, b) => {
        if (a.__sort_hasGrade !== b.__sort_hasGrade) return a.__sort_hasGrade ? -1 : 1;
        if (a.__sort_distance !== b.__sort_distance) return a.__sort_distance - b.__sort_distance;
        return String(resolveTestDate(b) || '').localeCompare(String(resolveTestDate(a) || ''));
      });
  }, [selectedDraftClassId, selectedDraftStudentId, selectedLessonDate, grades, tests]);

  const selectableTests = candidateTests;

  useEffect(() => {
    console.log('[lesson-report debug:data-sources]', {
      selectedStudentId: selectedDraftStudentId,
      selectedClassId: selectedDraftClassId,
      selectedDate: selectedLessonDate,
      lessonLogsCount: Array.isArray(lessonLogs) ? lessonLogs.length : null,
      homeworkAssignmentsCount: Array.isArray(homeworkAssignments) ? homeworkAssignments.length : null,
      testsCount: Array.isArray(tests) ? tests.length : null,
      attendanceLogsCount: Array.isArray(attendanceLogs) ? attendanceLogs.length : null,
      lessonLogsSample: lessonLogs?.slice?.(0, 3),
      homeworkAssignmentsSample: homeworkAssignments?.slice?.(0, 3),
      testsSample: tests?.slice?.(0, 3),
      candidateLessonLogsCount: candidateLessonLogs.length,
      candidateLessonLogsSample: candidateLessonLogs.slice(0, 3),
    });
  }, [
    attendanceLogs,
    candidateLessonLogs,
    homeworkAssignments,
    lessonLogs,
    selectedDraftClassId,
    selectedDraftStudentId,
    selectedLessonDate,
    tests,
  ]);

  useEffect(() => {
    console.log('[lesson-report debug:homework-candidates]', {
      selectedStudentId: selectedDraftStudentId,
      selectedClassId: selectedDraftClassId,
      selectedDate: selectedLessonDate,
      totalAssignments: homeworkAssignments?.length,
      candidateAssignments: candidateHomeworkAssignments,
    });
  }, [candidateHomeworkAssignments, homeworkAssignments?.length, selectedDraftClassId, selectedDraftStudentId, selectedLessonDate]);

  useEffect(() => {
    console.log('[lesson-report debug:test-candidates]', {
      selectedStudentId: selectedDraftStudentId,
      selectedClassId: selectedDraftClassId,
      selectedDate: selectedLessonDate,
      totalTests: tests?.length,
      candidateTests,
    });
  }, [candidateTests, selectedDraftClassId, selectedDraftStudentId, selectedLessonDate, tests?.length]);

  const previewHomeworkSummary = useMemo(
    () => summarizeHomework({
      selectedHomeworkIds: draft?.selectedHomeworkIds || [],
      homeworkAssignments,
      homeworkResults,
      studentId: draft?.studentId,
    }),
    [draft?.selectedHomeworkIds, draft?.studentId, homeworkAssignments, homeworkResults],
  );
  const previewAssignedHomeworkSummary = useMemo(
    () => summarizeAssignedHomework({
      selectedHomeworkIds: draft?.selectedHomeworkIds || [],
      homeworkAssignments,
    }),
    [draft?.selectedHomeworkIds, homeworkAssignments],
  );
  const previewTestSummary = useMemo(
    () => summarizeTests({
      selectedTestIds: draft?.selectedTestIds || [],
      tests,
      grades,
      studentId: draft?.studentId,
    }),
    [draft?.selectedTestIds, draft?.studentId, tests, grades],
  );

  useEffect(() => {
    setDraft((prev) => {
      if (!prev) return prev;
      const canReplaceLearnedTopics = !prev.isLearnedTopicsManuallyEdited
        || (prev.learnedTopics || '') === (prev.autoFilledLearnedTopics || '');
      const nextLearnedTopics = canReplaceLearnedTopics ? currentAutoFilledLearnedTopics : prev.learnedTopics;
      if (
        (prev.lessonLogId || null) === (currentLessonLog?.id || null)
        && (prev.autoFilledLearnedTopics || '') === currentAutoFilledLearnedTopics
        && (prev.learnedTopics || '') === (nextLearnedTopics || '')
      ) {
        return prev;
      }
      return {
        ...prev,
        lessonLogId: currentLessonLog?.id || null,
        autoFilledLearnedTopics: currentAutoFilledLearnedTopics,
        learnedTopics: nextLearnedTopics,
      };
    });
  }, [currentAutoFilledLearnedTopics, currentLessonLog?.id, draft?.classId, draft?.lessonDate, draft?.studentId]);

  const openDraftForStudent = (targetStudentId, existingReport = null) => {
    try {
      setDraftError('');
      const student = students.find((item) => String(item.id) === String(targetStudentId));
      if (!student) {
        setDraftError('학생 정보를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
        return;
      }

      const classId = String(selectedClassId || getStudentClassIds(student)[0] || '');
      const lessonDate = existingReport ? toYmd(existingReport.lessonDate) : String(selectedDate || todayYmd());
      const reportId = existingReport?.id || buildLessonReportId({
        studentId: targetStudentId,
        classId,
        lessonDate,
      });
      if (!reportId) {
        setDraftError('리포트 ID 생성에 실패했습니다. 클래스/학생/날짜 선택을 확인해 주세요.');
        return;
      }
      const lessonLog = (lessonLogs || []).find((log) => resolveClassId(log) === classId && resolveLessonLogDate(log) === lessonDate);
      const attendance = attendanceLogs.find((item) => String(item.studentId) === String(targetStudentId)
        && resolveClassId(item) === classId
        && resolveAttendanceDate(item) === lessonDate);

      setSelectedStudentId(String(targetStudentId));
      setActiveTab('edit');
      setDraft({
        ...(existingReport || {}),
        id: reportId,
        studentId: String(targetStudentId),
        classId,
        lessonDate,
        lessonLogId: existingReport?.lessonLogId || lessonLog?.id || null,
        attendanceStatus: existingReport?.attendanceStatus || attendance?.attendance || attendance?.status || '미기록',
        learnedTopics: existingReport?.learnedTopics ?? resolveLessonLogProgress(lessonLog),
        autoFilledLearnedTopics: resolveLessonLogProgress(lessonLog),
        isLearnedTopicsManuallyEdited: false,
        selectedHomeworkIds: existingReport?.selectedHomeworkIds || [],
        selectedTestIds: existingReport?.selectedTestIds || [],
        comment: existingReport?.comment || '',
        status: existingReport?.status || LESSON_REPORT_STATUS.DRAFT,
        studentNotificationSent: Boolean(existingReport?.studentNotificationSent),
        parentNotificationSent: Boolean(existingReport?.parentNotificationSent),
      });
    } catch (error) {
      setDraftError(error?.message || '리포트 초안 생성 중 오류가 발생했습니다.');
    }
  };

  const handleDraftSelectionChange = (changes) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextClassId = String(changes.classId ?? prev.classId);
      const nextLessonDate = String(changes.lessonDate ?? prev.lessonDate);
      const nextStudentId = String(changes.studentId ?? prev.studentId);
      const nextId = buildLessonReportId({ studentId: nextStudentId, classId: nextClassId, lessonDate: nextLessonDate });
      const existing = reportMap.get(nextId);
      const attendance = attendanceLogs.find((item) => String(item.studentId) === nextStudentId
        && resolveClassId(item) === nextClassId
        && resolveAttendanceDate(item) === nextLessonDate);
      const lessonLog = (lessonLogs || []).find((log) => resolveClassId(log) === nextClassId && resolveLessonLogDate(log) === nextLessonDate);
      if (existing) {
        return {
          ...prev,
          ...existing,
          ...changes,
          id: nextId,
          studentId: nextStudentId,
          classId: nextClassId,
          lessonDate: nextLessonDate,
          attendanceStatus: changes.attendanceStatus ?? existing.attendanceStatus ?? attendance?.attendance ?? attendance?.status ?? '미기록',
          autoFilledLearnedTopics: resolveLessonLogProgress(lessonLog),
          isLearnedTopicsManuallyEdited: false,
        };
      }

        return {
        ...prev,
        ...changes,
        id: nextId,
        attendanceStatus: changes.attendanceStatus ?? prev.attendanceStatus ?? attendance?.attendance ?? attendance?.status ?? '미기록',
        lessonLogId: lessonLog?.id || null,
        autoFilledLearnedTopics: resolveLessonLogProgress(lessonLog),
        learnedTopics: prev.isLearnedTopicsManuallyEdited ? prev.learnedTopics : (resolveLessonLogProgress(lessonLog) || prev.learnedTopics || ''),
      };
    });
  };

  const saveReport = async (send = false) => {
    if (!draft) return;
    setReportSaving(true);

    try {
    const now = serverTimestamp();
      const student = students.find((item) => String(item.id) === String(draft.studentId));
      const previous = reportMap.get(draft.id);
      const isFirstSend = send && !previous?.sentAt;

      const homeworkSummary = summarizeHomework({
        selectedHomeworkIds: draft.selectedHomeworkIds,
        homeworkAssignments,
        homeworkResults,
        studentId: draft.studentId,
      });
      const assignedHomeworkSummary = summarizeAssignedHomework({
        selectedHomeworkIds: draft.selectedHomeworkIds,
        homeworkAssignments,
      });
      const testSummary = summarizeTests({
        selectedTestIds: draft.selectedTestIds,
        tests,
        grades,
        studentId: draft.studentId,
      });

      const payload = {
        ...draft,
        homeworkSummary,
        assignedHomeworkSummary,
        testSummary,
        status: send ? LESSON_REPORT_STATUS.SENT : (previous?.status || LESSON_REPORT_STATUS.DRAFT),
        updatedAt: now,
        updatedBy: profileDocId || 'staff',
        createdAt: previous?.createdAt || now,
        createdBy: previous?.createdBy || profileDocId || 'staff',
        sentAt: previous?.sentAt || (isFirstSend ? now : null),
        sentBy: previous?.sentBy || (isFirstSend ? (profileDocId || 'staff') : null),
        lastEditedAfterSentAt: previous?.sentAt ? now : null,
      };

      delete payload.autoFilledLearnedTopics;
      delete payload.isLearnedTopicsManuallyEdited;

      await setDoc(doc(db, 'lessonReports', draft.id), payload, { merge: true });

      if (isFirstSend) {
        const parentAuthUids = await getLinkedParentAuthUids(draft.studentId, student?.parentAuthUids || []);
        const targetAuthUids = [student?.authUid, ...parentAuthUids].filter(Boolean);
        await Promise.all(targetAuthUids.map((uid) => addDoc(collection(db, 'notifications', uid, 'items'), {
          type: 'lesson_report',
          title: '새 수업 리포트가 도착했습니다.',
          body: `${student?.name || '학생'} 학생의 수업 리포트가 도착했습니다.`,
          isRead: false,
          createdAt: serverTimestamp(),
          payload: {
            reportId: draft.id,
            studentId: draft.studentId,
            classId: draft.classId,
            lessonDate: draft.lessonDate,
            type: 'lesson_report',
          },
        })));

        await setDoc(
          doc(db, 'lessonReports', draft.id),
          {
            studentNotificationSent: Boolean(student?.authUid),
            parentNotificationSent: parentAuthUids.length > 0,
          },
          { merge: true },
        );
      }

      setDraft(null);
      setDraftError('');
    } catch (error) {
      setDraftError(error?.message || '수업 리포트 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setReportSaving(false);
    }
  };

  const selectedClassName = availableClasses.find((item) => String(item.id) === String(draft?.classId || selectedClassId))?.name || '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">수업 리포트 관리</h2>
          <p className="text-sm text-gray-500">클래스/날짜 기준으로 학생 리포트를 한 번에 처리하세요.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-gray-100" onClick={() => navigate('/students')}>학생 관리</button>
        </div>
      </div>

      <section className="bg-white border rounded p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="border rounded p-2 text-sm">
            <option value="">클래스 선택</option>
            {availableClasses.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value || todayYmd())} className="border rounded p-2 text-sm" />
          <div className="text-sm text-gray-600 flex items-center">총 {classStudents.length}명</div>
        </div>
        {!isSelectedDateLessonDay && selectedClassId && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
            선택한 날짜는 이 클래스의 수업일이 아닙니다.
          </p>
        )}
        {draftError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
            {draftError}
          </p>
        )}

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">학생명</th>
                <th className="text-left px-3 py-2">상태</th>
                <th className="text-left px-3 py-2">발송 여부</th>
                <th className="text-right px-3 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((student) => {
                const reportId = buildLessonReportId({ studentId: student.id, classId: selectedClassId, lessonDate: selectedDate });
                const report = reportMap.get(reportId);
                return (
                  <tr key={student.id} className="border-t">
                    <td className="px-3 py-2 font-medium text-gray-800">{student.name || student.id}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClassName(report?.status)}`}>
                        {statusLabel(report?.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{report?.status === LESSON_REPORT_STATUS.SENT ? '발송됨' : '미발송'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs"
                        onClick={() => openDraftForStudent(student.id, report || null)}
                      >
                        {report ? '수정' : '작성'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {classStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                    {selectedClassId && !isSelectedDateLessonDay
                      ? '선택한 날짜는 수업일이 아니어서 학생 목록을 표시하지 않습니다.'
                      : '클래스를 선택하면 학생 목록이 표시됩니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        {!draft ? (
          <p className="text-sm text-gray-500">학생 목록에서 작성/수정 버튼을 눌러 리포트를 편집하세요.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {students.find((item) => String(item.id) === String(draft.studentId))?.name || draft.studentId} · {selectedClassName}
              </p>
              <div className="inline-flex rounded border overflow-hidden">
                <button className={`px-3 py-1.5 text-sm ${activeTab === 'edit' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`} onClick={() => setActiveTab('edit')}>편집</button>
                <button className={`px-3 py-1.5 text-sm ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`} onClick={() => setActiveTab('preview')}>미리보기</button>
              </div>
              </div>

            {activeTab === 'edit' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <select value={draft.studentId} onChange={(e) => handleDraftSelectionChange({ studentId: e.target.value })} className="border rounded p-2 text-sm">
                    {classStudents.map((student) => <option key={student.id} value={student.id}>{student.name || student.id}</option>)}
                  </select>
                  <select value={draft.classId} onChange={(e) => handleDraftSelectionChange({ classId: e.target.value })} className="border rounded p-2 text-sm">
                    {availableClasses.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                  <input type="date" value={draft.lessonDate} onChange={(e) => handleDraftSelectionChange({ lessonDate: e.target.value || todayYmd() })} className="border rounded p-2 text-sm" />
                </div>

                <input value={draft.attendanceStatus || ''} onChange={(e) => handleDraftSelectionChange({ attendanceStatus: e.target.value })} className="border rounded p-2 text-sm w-full" placeholder="출결" />
                <textarea
                  value={draft.learnedTopics || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, learnedTopics: e.target.value, isLearnedTopicsManuallyEdited: true }))}
                  className="border rounded p-2 text-sm w-full"
                  rows={4}
                  placeholder="진도"
                />
                <p className="text-xs text-gray-500">자동 채움 기준: {draft.classId} · {draft.lessonDate} · {draft.studentId}</p>

                <div>
                  <p className="text-sm font-semibold mb-1">숙제 선택</p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {selectableHomework.map((hw) => (
                      <label key={hw.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(draft.selectedHomeworkIds || []).includes(hw.id)}
                          onChange={(e) => setDraft((prev) => ({
                            ...prev,
                            selectedHomeworkIds: e.target.checked
                              ? [...(prev.selectedHomeworkIds || []), hw.id]
                              : (prev.selectedHomeworkIds || []).filter((id) => id !== hw.id),
                          }))}
                        />
                        {hw.title || hw.content || '숙제'}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">시험 선택</p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {selectableTests.map((test) => (
                      <label key={test.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(draft.selectedTestIds || []).includes(test.id)}
                          onChange={(e) => setDraft((prev) => ({
                            ...prev,
                            selectedTestIds: e.target.checked
                              ? [...(prev.selectedTestIds || []), test.id]
                              : (prev.selectedTestIds || []).filter((id) => id !== test.id),
                          }))}
                        />
                        {test.name}
                      </label>
                    ))}
                    {selectableTests.length === 0 && (
                      <p className="text-xs text-gray-500">선택 가능한 시험 없음</p>
                    )}
                  </div>
                </div>

                <textarea value={draft.comment || ''} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} className="border rounded p-2 text-sm w-full" rows={3} placeholder="코멘트" />

                <div className="flex justify-end gap-2">
                  <button className="px-3 py-2 rounded bg-gray-100" onClick={() => setDraft(null)} disabled={reportSaving}>닫기</button>
                  <button className="px-3 py-2 rounded bg-indigo-100 text-indigo-700" onClick={() => saveReport(false)} disabled={reportSaving}>저장</button>
                  <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={() => saveReport(true)} disabled={reportSaving}>발송</button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border bg-gray-50 p-4 space-y-3 text-sm">
                <h3 className="font-semibold text-base">수업 리포트 미리보기</h3>
                <p><span className="font-semibold">수업일 / 클래스:</span> {draft.lessonDate} / {availableClasses.find((item) => String(item.id) === String(draft.classId))?.name || draft.classId}</p>
                {draft.learnedTopics && <p><span className="font-semibold">진도:</span> {draft.learnedTopics}</p>}
                {draft.attendanceStatus && <p><span className="font-semibold">출결:</span> {draft.attendanceStatus}</p>}
                {previewHomeworkSummary.text?.length > 0 && <p><span className="font-semibold">과제 수행 정도:</span> {previewHomeworkSummary.text.join(', ')}</p>}
                {previewTestSummary.text?.length > 0 && <p><span className="font-semibold">시험 결과:</span> {previewTestSummary.text.join(', ')}</p>}
                {previewAssignedHomeworkSummary.items?.length > 0 && <p><span className="font-semibold">이번 수업 숙제:</span> {previewAssignedHomeworkSummary.items.map((item) => item.title).join(', ')}</p>}
                {draft.comment && <p><span className="font-semibold">코멘트:</span> {draft.comment}</p>}
                {!draft.comment && !draft.learnedTopics && !draft.attendanceStatus && previewHomeworkSummary.text?.length === 0 && previewTestSummary.text?.length === 0 && (
                  <p className="text-gray-500">표시할 내용이 없습니다.</p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}