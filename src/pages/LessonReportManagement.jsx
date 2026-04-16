import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/client';
import useAuth from '../auth/useAuth';
import { buildLessonReportId, LESSON_REPORT_STATUS, summarizeAssignedHomework, summarizeHomework, summarizeTests } from '../domain/lessonReport/lessonReport.service';
import { getLinkedParentAuthUids } from '../utils/parentLinking';

const toYmd = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
  try { return new Date(value).toISOString().slice(0, 10); } catch { return ''; }
};

export default function LessonReportManagement() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { profileDocId } = useAuth();
  const [student, setStudent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [lessonLogs, setLessonLogs] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [homeworkAssignments, setHomeworkAssignments] = useState([]);
  const [tests, setTests] = useState([]);
  const [homeworkResults, setHomeworkResults] = useState({});
  const [grades, setGrades] = useState({});
  const [lessonReports, setLessonReports] = useState([]);
  const [draft, setDraft] = useState(null);
  const [reportSaving, setReportSaving] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    getDoc(doc(db, 'users', studentId)).then((snap) => setStudent(snap.exists() ? { id: snap.id, ...snap.data() } : null));

    const unsub = onSnapshot(
      query(collection(db, 'lessonReports'), where('studentId', '==', studentId), orderBy('lessonDate', 'desc'), limit(100)),
      (snap) => setLessonReports(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );

    (async () => {
      const classIds = await getDoc(doc(db, 'users', studentId)).then((snap) => (snap.data()?.classIds || snap.data()?.classes || []).map(String));
      if (!classIds.length) return;
      const classSnap = await getDocs(query(collection(db, 'classes'), where('__name__', 'in', classIds.slice(0, 10))));
      const classRows = classSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClasses(classRows);
      const [logSnap, attendanceSnap, hwSnap, testSnap] = await Promise.all([
        getDocs(query(collection(db, 'lessonLogs'), where('classId', 'in', classIds.slice(0, 10)), orderBy('date', 'desc'), limit(200))),
        getDocs(query(collection(db, 'attendanceLogs'), where('studentId', '==', studentId), orderBy('date', 'desc'), limit(200))),
        getDocs(query(collection(db, 'homeworkAssignments'), where('classId', 'in', classIds.slice(0, 10)), orderBy('date', 'desc'), limit(200))),
        getDocs(query(collection(db, 'tests'), where('classId', 'in', classIds.slice(0, 10)), orderBy('date', 'desc'), limit(200))),
      ]);
      setLessonLogs(logSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAttendanceLogs(attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setHomeworkAssignments(hwSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTests(testSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const hwResultSnap = await getDocs(query(collection(db, 'homeworkResults'), where('studentId', '==', studentId), limit(300)));
      const hwMap = {}; hwResultSnap.docs.forEach((d) => { const data = d.data(); hwMap[data.assignmentId || data.homeworkAssignmentId] = data.results || data; });
      setHomeworkResults({ [studentId]: hwMap });
      const gradeSnap = await getDocs(query(collection(db, 'grades'), where('studentId', '==', studentId), limit(300)));
      const gradeMap = {}; gradeSnap.docs.forEach((d) => { const data = d.data(); if (data.testId) gradeMap[data.testId] = data; });
      setGrades({ [studentId]: gradeMap });
    })();

    return () => unsub();
  }, [studentId]);

  const openNewDraft = () => {
    const activeClassId = String(classes[0]?.id || '');
    const lessonDate = toYmd(lessonLogs.find((log) => String(log.classId) === activeClassId)?.date || new Date());
    const lessonLog = lessonLogs.find((log) => String(log.classId) === activeClassId && toYmd(log.date) === lessonDate);
    const attendance = attendanceLogs.find((item) => String(item.classId || item.classDocId || '') === activeClassId && toYmd(item.date) === lessonDate);
    setDraft({
      id: buildLessonReportId({ studentId, classId: activeClassId, lessonDate }),
      studentId,
      classId: activeClassId,
      lessonDate,
      lessonLogId: lessonLog?.id || null,
      attendanceStatus: attendance?.attendance || attendance?.status || '미기록',
      learnedTopics: lessonLog?.progress || '',
      selectedHomeworkIds: [],
      selectedTestIds: [],
      comment: '',
      status: LESSON_REPORT_STATUS.DRAFT,
      studentNotificationSent: false,
      parentNotificationSent: false,
    });
  };

  const selectableHomework = useMemo(() => (homeworkAssignments || []).filter((item) => {
    if (String(item.classId || item.classDocId || '') !== String(draft?.classId || '')) return false;
    const targets = [...(Array.isArray(item.targetStudents) ? item.targetStudents : []), ...(Array.isArray(item.assignedStudentIds) ? item.assignedStudentIds : [])].map(String);
    return targets.length === 0 || targets.includes(String(studentId));
  }), [homeworkAssignments, draft?.classId, studentId]);

  const selectableTests = useMemo(() => (tests || []).filter((item) => String(item.classId || '') === String(draft?.classId || '')), [tests, draft?.classId]);

  const saveReport = async (send = false) => {
    if (!draft) return;
    setReportSaving(true);
    try {
    const now = serverTimestamp();
    const homeworkSummary = summarizeHomework({ selectedHomeworkIds: draft.selectedHomeworkIds, homeworkAssignments, homeworkResults, studentId });
    const assignedHomeworkSummary = summarizeAssignedHomework({ selectedHomeworkIds: draft.selectedHomeworkIds, homeworkAssignments });
    const testSummary = summarizeTests({ selectedTestIds: draft.selectedTestIds, tests, grades, studentId });
    const prev = lessonReports.find((item) => item.id === draft.id);
    const isFirstSend = send && !prev?.sentAt;
    const payload = {
      ...draft,
      homeworkSummary,
      assignedHomeworkSummary,
      testSummary,
      status: send ? LESSON_REPORT_STATUS.SENT : (prev?.status || LESSON_REPORT_STATUS.DRAFT),
      updatedAt: now,
      updatedBy: profileDocId || 'staff',
      createdAt: prev?.createdAt || now,
      createdBy: prev?.createdBy || profileDocId || 'staff',
      sentAt: prev?.sentAt || (isFirstSend ? now : null),
      sentBy: prev?.sentBy || (isFirstSend ? (profileDocId || 'staff') : null),
      lastEditedAfterSentAt: prev?.sentAt ? now : null,
    };
    await setDoc(doc(db, 'lessonReports', draft.id), payload, { merge: true });

    if (isFirstSend) {
      const parentAuthUids = await getLinkedParentAuthUids(studentId, student?.parentAuthUids || []);
      const targetAuthUids = [student?.authUid, ...parentAuthUids].filter(Boolean);
      await Promise.all(targetAuthUids.map((uid) => addDoc(collection(db, 'notifications', uid, 'items'), {
        type: 'lesson_report',
        title: '새 수업 리포트가 도착했습니다.',
        body: `${student?.name || '학생'} 학생의 수업 리포트가 도착했습니다.`,
        isRead: false,
        createdAt: serverTimestamp(),
        payload: { reportId: draft.id, studentId, classId: draft.classId, lessonDate: draft.lessonDate, type: 'lesson_report' },
      })));
      await setDoc(doc(db, 'lessonReports', draft.id), { studentNotificationSent: Boolean(student?.authUid), parentNotificationSent: parentAuthUids.length > 0 }, { merge: true });
    }

    setDraft(null);
    } finally {
      setReportSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">회차별 수업 리포트 · {student?.name || studentId}</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-gray-100" onClick={() => navigate(`/students/${studentId}`)}>학생 상세</button>
          <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={openNewDraft}>초안 생성</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-white border rounded p-4 space-y-2">
          <h3 className="font-semibold">리포트 목록</h3>
          {lessonReports.map((report) => (
            <button key={report.id} onClick={() => setDraft(report)} className="w-full text-left border rounded p-3 hover:bg-gray-50">
              <p className="text-xs text-gray-500">{report.lessonDate} · {classes.find((c) => String(c.id) === String(report.classId))?.name || report.classId}</p>
              <p className="text-sm font-semibold">상태: {report.status}</p>
              <p className="text-xs text-gray-600 line-clamp-2">{report.comment || report.learnedTopics || '내용 없음'}</p>
            </button>
          ))}
          {lessonReports.length === 0 && <p className="text-sm text-gray-500">아직 생성된 리포트가 없습니다.</p>}
        </section>

        <section className="bg-white border rounded p-4 space-y-3">
          {!draft ? <p className="text-sm text-gray-500">왼쪽 리포트를 선택하거나 초안을 생성하세요.</p> : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <select value={draft.classId} onChange={(e) => setDraft((prev) => ({ ...prev, classId: e.target.value }))} className="border rounded p-2 text-sm">
                  {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
                <input type="date" value={draft.lessonDate} onChange={(e) => setDraft((prev) => ({ ...prev, lessonDate: e.target.value, id: buildLessonReportId({ studentId, classId: prev.classId, lessonDate: e.target.value }) }))} className="border rounded p-2 text-sm" />
              </div>
              <input value={draft.attendanceStatus || ''} onChange={(e) => setDraft((prev) => ({ ...prev, attendanceStatus: e.target.value }))} className="border rounded p-2 text-sm w-full" placeholder="출결" />
              <textarea value={draft.learnedTopics || ''} onChange={(e) => setDraft((prev) => ({ ...prev, learnedTopics: e.target.value }))} className="border rounded p-2 text-sm w-full" rows={3} placeholder="오늘 배운 내용" />
              <div>
                <p className="text-sm font-semibold mb-1">숙제 선택</p>
                <div className="space-y-1 max-h-32 overflow-auto">{selectableHomework.map((hw) => (
                  <label key={hw.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(draft.selectedHomeworkIds || []).includes(hw.id)} onChange={(e) => setDraft((prev) => ({ ...prev, selectedHomeworkIds: e.target.checked ? [...(prev.selectedHomeworkIds || []), hw.id] : (prev.selectedHomeworkIds || []).filter((id) => id !== hw.id) }))} />{hw.title || hw.content || '숙제'}</label>
                ))}</div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">시험 선택</p>
                <div className="space-y-1 max-h-32 overflow-auto">{selectableTests.map((test) => (
                  <label key={test.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(draft.selectedTestIds || []).includes(test.id)} onChange={(e) => setDraft((prev) => ({ ...prev, selectedTestIds: e.target.checked ? [...(prev.selectedTestIds || []), test.id] : (prev.selectedTestIds || []).filter((id) => id !== test.id) }))} />{test.name}</label>
                ))}</div>
              </div>
              <textarea value={draft.comment || ''} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} className="border rounded p-2 text-sm w-full" rows={3} placeholder="코멘트(1개)" />
              <div className="flex justify-end gap-2">
                <button className="px-3 py-2 rounded bg-gray-100" onClick={() => setDraft(null)} disabled={reportSaving}>닫기</button>
                <button className="px-3 py-2 rounded bg-indigo-100 text-indigo-700" onClick={() => saveReport(false)} disabled={reportSaving}>저장</button>
                <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={() => saveReport(true)} disabled={reportSaving}>발송</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}