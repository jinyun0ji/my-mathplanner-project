import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/client';
import useAuth from '../auth/useAuth';
import {
  buildLessonReportId,
  LESSON_REPORT_SEND_STATUS,
  LESSON_REPORT_STATUS,
  getGradeForLessonReportStudent,
  summarizeAssignedHomework,
  summarizeHomework,
  summarizeTests,
} from '../domain/lessonReport/lessonReport.service';
import { resolveHomeworkAssignmentTitle } from '../domain/homework/homework.service';
import { getLinkedParentAuthUids } from '../utils/parentLinking';
import { filterRosterByWithdrawDate } from '../utils/rosterFilter';
import { hasClassOnDate, isClosedForClass } from '../utils/helpers';
import { formatClassLabel, sortClassesWithClosedLast } from '../utils/classStatus';
import { FEATURES } from '../config/features';

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

const statusLabel = (status, sendStatus, scheduledSendAt, isModified = false) => {
  if (status === LESSON_REPORT_STATUS.SENT) return '발송완료';
  if (sendStatus === LESSON_REPORT_SEND_STATUS.SCHEDULED || Boolean(scheduledSendAt)) return '예약됨';
  if (status === LESSON_REPORT_STATUS.DRAFT && isModified) return '수정됨';
  if (status === LESSON_REPORT_STATUS.DRAFT) return '초안';
  return '미생성';
};

const statusClassName = (status, sendStatus, scheduledSendAt) => {
  if (status === LESSON_REPORT_STATUS.SENT) return 'bg-green-100 text-green-700';
  if (sendStatus === LESSON_REPORT_SEND_STATUS.SCHEDULED || Boolean(scheduledSendAt)) return 'bg-yellow-100 text-yellow-700';
  if (status === LESSON_REPORT_STATUS.DRAFT) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
};

const getStudentClassIds = (student) => {
  if (!student) return [];
  if (Array.isArray(student.classIds)) return student.classIds.map(String);
  if (Array.isArray(student.classes)) return student.classes.map(String);
  return [];
};

const buildStudentKeys = (student = null) => Array.from(new Set([
  student?.id,
  student?.uid,
  student?.userUid,
  student?.authUid,
  student?.studentId,
  student?.docId,
].filter((value) => value !== null && value !== undefined).map((value) => String(value).trim()).filter(Boolean)));

const hasAnyStudentKey = (values = [], studentKeys = []) => {
  const keySet = new Set(studentKeys.map(String));
  return values
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim())
    .some((value) => keySet.has(value));
};

const mergeById = (base = [], extra = []) => {
  const merged = new Map();
  [...(Array.isArray(base) ? base : []), ...(Array.isArray(extra) ? extra : [])].forEach((item) => {
    if (!item) return;
    const key = String(item.id || '');
    if (!key) return;
    merged.set(key, { ...(merged.get(key) || {}), ...item });
  });
  return Array.from(merged.values());
};

const mergeNestedResults = (base = {}, extra = {}) => {
  const merged = { ...(base || {}) };
  Object.entries(extra || {}).forEach(([studentKey, assignments]) => {
    merged[studentKey] = { ...(merged[studentKey] || {}), ...(assignments || {}) };
  });
  return merged;
};

const chunkArray = (items, size = 10) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};


const getDateMatches = (item, fields = [], lessonDate) => fields
  .map((field) => toYmd(item?.[field]))
  .filter(Boolean)
  .filter((date) => date === String(lessonDate || ''));

const resolveHomeworkResultDate = (item) => toYmd(item?.date || item?.lessonDate || item?.createdAt || item?.updatedAt || item?.submittedAt || item?.completedAt);
const resolveScheduledTestDate = (item) => toYmd(item?.date || item?.testDate || item?.lessonDate);

const getHomeworkResultForStudentAssignment = ({ homeworkResults = {}, assignmentId, student, studentId = '' }) => {
  if (!assignmentId) return null;
  const studentKeys = Array.from(new Set([
    ...buildStudentKeys(student),
    studentId,
  ].filter((value) => value !== null && value !== undefined).map((value) => String(value).trim()).filter(Boolean)));

  for (const key of studentKeys) {
    const nestedResult = homeworkResults?.[key]?.[assignmentId];
    if (nestedResult !== undefined && nestedResult !== null) return nestedResult;
  }

  const resultCandidates = [homeworkResults, ...Object.values(homeworkResults || {})];

  for (const value of resultCandidates) {
    if (!value || typeof value !== 'object') continue;

    const nestedResult = value?.[assignmentId];
    if (nestedResult && typeof nestedResult === 'object' && hasAnyStudentKey([
      nestedResult.studentId,
      nestedResult.studentDocId,
      nestedResult.authUid,
      nestedResult.studentUid,
      nestedResult.userUid,
      nestedResult.uid,
    ], studentKeys)) {
      return nestedResult;
    }

    if (String(value?.assignmentId || '') === String(assignmentId)
      && hasAnyStudentKey([
        value.studentId,
        value.studentDocId,
        value.authUid,
        value.studentUid,
        value.userUid,
        value.uid,
      ], studentKeys)) {
      return value;
    }
  }

  return null;
};

const isHomeworkResultNewForLesson = (result, lessonDate) => {
  if (!result) return false;
  const resultDate = resolveHomeworkResultDate(result);
  return !resultDate || resultDate === String(lessonDate || '');
};

const HOMEWORK_LESSON_LINK_DATE_FIELDS = ['lessonDate', 'assignedDate', 'date', 'dueDate', 'deadline', 'createdAt'];

const isHomeworkLinkedToLessonDate = (assignment, lessonDate) => (
  getDateMatches(assignment, HOMEWORK_LESSON_LINK_DATE_FIELDS, lessonDate).length > 0
);

const isHomeworkAssignedOnLessonDate = isHomeworkLinkedToLessonDate;

const normalizeInspectionStatus = (assignment) => String(assignment?.inspectionStatus || 'pending').trim() || 'pending';
const isPendingHomeworkInspection = (assignment) => normalizeInspectionStatus(assignment) !== 'completed';
const getHomeworkTargetKeys = (assignment) => [
  ...(Array.isArray(assignment?.targetStudents) ? assignment.targetStudents : []),
  ...(Array.isArray(assignment?.assignedStudentIds) ? assignment.assignedStudentIds : []),
  ...(Array.isArray(assignment?.students) ? assignment.students : []),
];
const isHomeworkTargetedToStudent = (assignment, student) => {
  const targets = getHomeworkTargetKeys(assignment);
  if (targets.length === 0) return true;
  return hasAnyStudentKey(targets, buildStudentKeys(student));
};


const getHomeworkFilterReason = ({ assignment, lessonDate, student, studentId, homeworkResults }) => {
  if (!isHomeworkLinkedToLessonDate(assignment, lessonDate)) return 'lesson-date-mismatch';
  if (!isHomeworkTargetedToStudent(assignment, student)) return 'student-not-targeted';
  const hasResult = Boolean(getHomeworkResultForStudentAssignment({ homeworkResults, assignmentId: assignment?.id, student, studentId }));
  if (!isPendingHomeworkInspection(assignment) && !hasResult) return 'completed-without-result';
  return 'included';
};

const isHomeworkCandidateForLessonReport = (assignment, lessonDate) => (
  isPendingHomeworkInspection(assignment) || isHomeworkLinkedToLessonDate(assignment, lessonDate)
);


const isTestHeldOnLessonDate = (test, lessonDate) => (
  getDateMatches(test, ['date', 'testDate', 'lessonDate'], lessonDate).length > 0
);

const getAttendanceForStudent = ({ attendanceLogs = [], student, classId, lessonDate }) => {
  const studentKeys = buildStudentKeys(student);
  return attendanceLogs.find((item) => hasAnyStudentKey([item.studentId, item.studentUid], studentKeys)
    && resolveClassId(item) === String(classId || '')
    && resolveAttendanceDate(item) === String(lessonDate || '')) || null;
};

const getLessonLogForClassDate = ({ lessonLogs = [], classId, lessonDate }) => (
  (lessonLogs || []).find((log) => resolveClassId(log) === String(classId || '') && resolveLessonLogDate(log) === String(lessonDate || '')) || null
);

const getHomeworkAssignmentsForStudent = ({ homeworkAssignments = [], student, classId, lessonDate, onlyTargeted = false }) => {
  const studentKeys = buildStudentKeys(student);
  return (homeworkAssignments || [])
    .filter((item) => resolveClassId(item) === String(classId || ''))
    .map((item) => ({ ...item, __candidate_distance: Math.abs(new Date(`${resolveHomeworkDate(item)}T00:00:00`).getTime() - new Date(`${lessonDate}T00:00:00`).getTime()) || Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.__candidate_distance - b.__candidate_distance)
    .filter((item) => {
      if (!onlyTargeted) return true;
      const targets = [
        ...(Array.isArray(item.targetStudents) ? item.targetStudents : []),
        ...(Array.isArray(item.assignedStudentIds) ? item.assignedStudentIds : []),
        ...(Array.isArray(item.students) ? item.students : []),
      ];
      return targets.length === 0 || hasAnyStudentKey(targets, studentKeys);
    });
};

const getTestsForStudent = ({ tests = [], grades = {}, student, studentId, classId, lessonDate }) => (
  (tests || [])
    .filter((item) => resolveClassId(item) === String(classId || ''))
    .map((item) => ({
      ...item,
      __sort_hasGrade: Boolean(getGradeForLessonReportStudent({ student, studentId, grades, testId: item.id })),
      __sort_distance: Math.abs(new Date(`${resolveTestDate(item)}T00:00:00`).getTime() - new Date(`${lessonDate}T00:00:00`).getTime()) || Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => (a.__sort_hasGrade === b.__sort_hasGrade ? a.__sort_distance - b.__sort_distance : (a.__sort_hasGrade ? -1 : 1)))
);



export default function LessonReportManagement({
  students = [],
  classes = [],
  lessonLogs = [],
  attendanceLogs: propAttendanceLogs = [],
  homeworkAssignments: propHomeworkAssignments = [],
  tests: propTests = [],
  homeworkResults: propHomeworkResults = {},
  grades: propGrades = {},
  lessonReports = [],
  closures = [],
  classTestStats = {},
}) {
  const { studentId: routeStudentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profileDocId, user } = useAuth();
  
  const preselectedStudentId = String(routeStudentId || searchParams.get('studentId') || '');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [selectedStudentId, setSelectedStudentId] = useState(preselectedStudentId);
  const [draft, setDraft] = useState(null);
  const [draftError, setDraftError] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [selectedStudentIdsForBulk, setSelectedStudentIdsForBulk] = useState([]);
  const [sendMode, setSendMode] = useState('now');
  const [scheduledSendAt, setScheduledSendAt] = useState('');
  const [localReportMap, setLocalReportMap] = useState({});
  const [bulkDraftCreating, setBulkDraftCreating] = useState(false);
  const [directLessonReportData, setDirectLessonReportData] = useState({
    attendanceLogs: [],
    homeworkAssignments: [],
    homeworkResults: {},
    tests: [],
    grades: {},
  });

  const attendanceLogs = useMemo(
    () => mergeById(propAttendanceLogs, directLessonReportData.attendanceLogs),
    [directLessonReportData.attendanceLogs, propAttendanceLogs],
  );
  const homeworkAssignments = useMemo(
    () => mergeById(propHomeworkAssignments, directLessonReportData.homeworkAssignments),
    [directLessonReportData.homeworkAssignments, propHomeworkAssignments],
  );
  const tests = useMemo(
    () => mergeById(propTests, directLessonReportData.tests),
    [directLessonReportData.tests, propTests],
  );
  const homeworkResults = useMemo(
    () => mergeNestedResults(propHomeworkResults, directLessonReportData.homeworkResults),
    [directLessonReportData.homeworkResults, propHomeworkResults],
  );
  const grades = useMemo(
    () => mergeNestedResults(propGrades, directLessonReportData.grades),
    [directLessonReportData.grades, propGrades],
  );

  const availableClasses = useMemo(
    () => sortClassesWithClosedLast(classes).filter((item) => item?.id),
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

  useEffect(() => {
    setSelectedStudentIdsForBulk([]);
  }, [selectedClassId, selectedDate]);

  const baseReportMap = useMemo(() => {
    const map = new Map();
    lessonReports.forEach((report) => {
      const normalizedLessonDate = toYmd(report.lessonDate);
      const key = buildLessonReportId({
        studentId: report.studentId,
        classId: report.classId,
        lessonDate: normalizedLessonDate,
      });
      if (process.env.NODE_ENV === 'development') {
        console.debug('[lesson-report map] firestore report', {
          reportId: report?.id,
          studentId: report?.studentId,
          classId: report?.classId,
          lessonDate: normalizedLessonDate || report?.lessonDate,
          generatedKey: key,
          status: report?.status,
          sendStatus: report?.sendStatus,
        });
      }
      if (key) map.set(key, { ...report, id: report.id || key, lessonDate: normalizedLessonDate || report.lessonDate });
    });
    return map;
  }, [lessonReports]);

  const reportMap = useMemo(() => {
    const merged = new Map(baseReportMap);
    Object.values(localReportMap || {}).forEach((report) => {
      const normalizedLessonDate = toYmd(report?.lessonDate);
      const key = buildLessonReportId({
        studentId: report?.studentId,
        classId: report?.classId,
        lessonDate: normalizedLessonDate,
      });
      if (process.env.NODE_ENV === 'development') {
        console.debug('[lesson-report map] local report', {
          reportId: report?.id,
          studentId: report?.studentId,
          classId: report?.classId,
          lessonDate: normalizedLessonDate || report?.lessonDate,
          generatedKey: key,
          status: report?.status,
          sendStatus: report?.sendStatus,
        });
      }
      if (key) merged.set(key, { ...report, id: report.id || key, lessonDate: normalizedLessonDate || report.lessonDate });
    });
    return merged;
  }, [baseReportMap, localReportMap]);

  const selectedLessonDate = toYmd(draft?.lessonDate || selectedDate || '');
  const selectedDraftClassId = String(draft?.classId || selectedClassId || '');
  const selectedDraftStudentId = String(draft?.studentId || selectedStudentId || '');
  const selectedDraftStudent = useMemo(
    () => students.find((student) => String(student.id) === selectedDraftStudentId) || null,
    [selectedDraftStudentId, students],
  );
  const selectedStudentKeys = useMemo(() => buildStudentKeys(selectedDraftStudent), [selectedDraftStudent]);

  useEffect(() => {
    let cancelled = false;
    const loadDirectLessonReportData = async () => {
      if (!selectedDraftClassId || !selectedLessonDate) {
        setDirectLessonReportData({ attendanceLogs: [], homeworkAssignments: [], homeworkResults: {}, tests: [], grades: {} });
        return;
      }

      try {
        const [attendanceSnap, homeworkSnap, testsSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'attendanceLogs'),
            where('classId', '==', selectedDraftClassId),
            where('date', '==', selectedLessonDate),
          )),
          getDocs(query(collection(db, 'homeworkAssignments'), where('classId', '==', selectedDraftClassId))),
          getDocs(query(collection(db, 'tests'), where('classId', '==', selectedDraftClassId))),
        ]);

        const directAttendanceLogs = attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const directHomeworkAssignments = homeworkSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((assignment) => isHomeworkCandidateForLessonReport(assignment, selectedLessonDate));
        const directTests = testsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((test) => isTestHeldOnLessonDate(test, selectedLessonDate));

        const assignmentIds = directHomeworkAssignments.map((assignment) => String(assignment.id)).filter(Boolean);
        const testIds = directTests.map((test) => String(test.id)).filter(Boolean);
        const [homeworkResultDocs, gradeDocs] = await Promise.all([
          Promise.all(chunkArray(assignmentIds, 10).map((ids) => getDocs(query(
            collection(db, 'homeworkResults'),
            where('assignmentId', 'in', ids),
          )))),
          Promise.all(chunkArray(testIds, 10).map((ids) => getDocs(query(
            collection(db, 'grades'),
            where('testId', 'in', ids),
          )))),
        ]);

        const directHomeworkResults = {};
        homeworkResultDocs.flatMap((snap) => snap.docs).forEach((d) => {
          const data = { id: d.id, ...d.data() };
          const assignmentId = data.assignmentId || data.homeworkAssignmentId || data.homeworkId;
          const studentKey = data.studentId || data.studentDocId || data.authUid || data.studentUid || data.userUid || data.uid;
          if (!assignmentId || !studentKey) return;
          if (!directHomeworkResults[String(studentKey)]) directHomeworkResults[String(studentKey)] = {};
          directHomeworkResults[String(studentKey)][String(assignmentId)] = data.results || data;
        });

        const directGrades = {};
        gradeDocs.flatMap((snap) => snap.docs).forEach((d) => {
          const data = { id: d.id, ...d.data() };
          const studentKey = data.studentId || data.studentDocId || data.authUid || data.studentUid || data.userUid || data.uid;
          const testId = data.testId;
          if (!studentKey || !testId) return;
          if (!directGrades[String(studentKey)]) directGrades[String(studentKey)] = {};
          directGrades[String(studentKey)][String(testId)] = data;
        });

        if (!cancelled) {
          setDirectLessonReportData({
            attendanceLogs: directAttendanceLogs,
            homeworkAssignments: directHomeworkAssignments,
            homeworkResults: directHomeworkResults,
            tests: directTests,
            grades: directGrades,
          });
        }
      } catch (error) {
        console.warn('[lesson-report] selected class/date scoped load failed', error);
      }
    };

    loadDirectLessonReportData();
    return () => {
      cancelled = true;
    };
  }, [selectedDraftClassId, selectedLessonDate]);

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

  const classHomeworkAssignments = useMemo(() => (homeworkAssignments || [])
    .filter((item) => resolveClassId(item) === selectedDraftClassId)
    .map((item) => ({
      ...item,
      __candidate_distance: toDateDistance(resolveHomeworkDate(item), selectedLessonDate),
    }))
    .sort((a, b) => {
      if (a.__candidate_distance !== b.__candidate_distance) return a.__candidate_distance - b.__candidate_distance;
      return String(resolveHomeworkDate(b) || '').localeCompare(String(resolveHomeworkDate(a) || ''));
    }), [homeworkAssignments, selectedDraftClassId, selectedLessonDate]);

  const candidateHomeworkAssignments = useMemo(() => classHomeworkAssignments
    .map((item) => {
      const targets = [
        ...(Array.isArray(item.targetStudents) ? item.targetStudents : []),
        ...(Array.isArray(item.assignedStudentIds) ? item.assignedStudentIds : []),
        ...(Array.isArray(item.students) ? item.students : []),
      ];
      const isTargeted = targets.length === 0 || hasAnyStudentKey(targets, selectedStudentKeys);
      return { ...item, __candidate_isTargeted: isTargeted, __candidate_targetKeys: targets.map(String) };
    })
    .filter((item) => item.__candidate_isTargeted), [classHomeworkAssignments, selectedStudentKeys]);

  const selectableHomeworkProgress = candidateHomeworkAssignments
    .map((item) => ({ ...item, __candidate_isPendingInspection: isPendingHomeworkInspection(item) }))
    .sort((a, b) => {
      if (a.__candidate_isPendingInspection !== b.__candidate_isPendingInspection) return a.__candidate_isPendingInspection ? -1 : 1;
      if (a.__candidate_distance !== b.__candidate_distance) return a.__candidate_distance - b.__candidate_distance;
      return String(resolveHomeworkDate(b) || '').localeCompare(String(resolveHomeworkDate(a) || ''));
    });

  const selectableAssignedHomework = classHomeworkAssignments;

  const candidateTests = useMemo(() => {
    if (!selectedDraftClassId) return [];
    return (tests || [])
      .filter((item) => resolveClassId(item) === selectedDraftClassId)
      .map((item) => {
        const grade = getGradeForLessonReportStudent({
          student: selectedDraftStudent,
          studentId: selectedDraftStudentId,
          grades,
          testId: item.id,
        });
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
  }, [grades, selectedDraftClassId, selectedDraftStudent, selectedLessonDate, tests]);

  const selectableTests = candidateTests;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    console.log('[lesson-report debug:data-sources]', {
      props: {
        studentsCount: Array.isArray(students) ? students.length : null,
        classesCount: Array.isArray(classes) ? classes.length : null,
        lessonLogsCount: Array.isArray(lessonLogs) ? lessonLogs.length : null,
        attendanceLogsCount: Array.isArray(propAttendanceLogs) ? propAttendanceLogs.length : null,
        homeworkAssignmentsCount: Array.isArray(propHomeworkAssignments) ? propHomeworkAssignments.length : null,
        homeworkResultsCount: Object.values(propHomeworkResults || {}).filter((value) => value && typeof value === 'object').length,
        testsCount: Array.isArray(propTests) ? propTests.length : null,
        gradesCount: Object.values(propGrades || {}).filter((value) => value && typeof value === 'object').length,
        lessonReportsCount: Array.isArray(lessonReports) ? lessonReports.length : null,
      },
      selectedStudentId: selectedDraftStudentId,
      selectedClassId: selectedDraftClassId,
      selectedDate: selectedLessonDate,
      selectedStudent: selectedDraftStudent,
      selectedStudentKeys,
      studentsCount: Array.isArray(students) ? students.length : null,
      classesCount: Array.isArray(classes) ? classes.length : null,
      lessonLogsCount: Array.isArray(lessonLogs) ? lessonLogs.length : null,
      homeworkAssignmentsCount: Array.isArray(homeworkAssignments) ? homeworkAssignments.length : null,
      testsCount: Array.isArray(tests) ? tests.length : null,
      attendanceLogsCount: Array.isArray(attendanceLogs) ? attendanceLogs.length : null,
      homeworkResultsMatchedCount: Object.values(homeworkResults || {}).filter((value) => value && typeof value === 'object').length,
      gradesMatchedCount: Object.values(grades || {}).filter((value) => value && typeof value === 'object').length,
      lessonReportsCount: Array.isArray(lessonReports) ? lessonReports.length : null,
      lessonLogsSample: lessonLogs?.slice?.(0, 3),
      homeworkAssignmentsSample: homeworkAssignments?.slice?.(0, 3),
      testsSample: tests?.slice?.(0, 3),
      candidateLessonLogsCount: candidateLessonLogs.length,
      candidateLessonLogsSample: candidateLessonLogs.slice(0, 3),
    });
  }, [
    attendanceLogs,
    candidateLessonLogs,
    classes,
    homeworkAssignments,
    lessonLogs,
    lessonReports,
    propAttendanceLogs,
    propGrades,
    propHomeworkAssignments,
    propHomeworkResults,
    propTests,
    selectedDraftClassId,
    selectedDraftStudentId,
    selectedDraftStudent,
    selectedLessonDate,
    selectedStudentKeys,
    tests,
    students,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const classMatchedAssignments = (homeworkAssignments || []).filter((item) => resolveClassId(item) === selectedDraftClassId);
    const filteredAssignments = classMatchedAssignments.map((assignment) => ({
      id: assignment.id,
      title: resolveHomeworkAssignmentTitle(assignment),
      lessonDate: assignment.lessonDate,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate || assignment.deadline,
      createdAt: assignment.createdAt,
      filteredReason: getHomeworkFilterReason({
        assignment,
        lessonDate: selectedLessonDate,
        student: selectedDraftStudent,
        studentId: selectedDraftStudentId,
        homeworkResults,
      }),
    }));
    console.log('[lesson-report debug:homework-candidates]', {
      reportLessonDate: selectedLessonDate,
      selectedStudentId: selectedDraftStudentId,
      selectedStudent: selectedDraftStudent,
      studentKeys: selectedStudentKeys,
      selectedClassId: selectedDraftClassId,
      homeworkTotalCount: homeworkAssignments?.length,
      matchedHomeworkCount: classMatchedAssignments.length,
      filteredHomeworkCount: filteredAssignments.filter((item) => item.filteredReason === 'included').length,
      filteredReasons: filteredAssignments,
      candidateAssignments: candidateHomeworkAssignments,
    });
  }, [candidateHomeworkAssignments, homeworkAssignments, homeworkResults, selectedDraftClassId, selectedDraftStudent, selectedDraftStudentId, selectedLessonDate, selectedStudentKeys]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    console.log('[lesson-report debug:test-candidates]', {
      selectedStudentId: selectedDraftStudentId,
      selectedStudent: selectedDraftStudent,
      studentKeys: selectedStudentKeys,
      selectedClassId: selectedDraftClassId,
      selectedDate: selectedLessonDate,
      totalTests: tests?.length,
      candidateTests,
    });
  }, [candidateTests, selectedDraftClassId, selectedDraftStudent, selectedDraftStudentId, selectedLessonDate, selectedStudentKeys, tests?.length]);



  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const attendanceMatches = (attendanceLogs || []).filter((item) => hasAnyStudentKey([item.studentId, item.studentUid], selectedStudentKeys)
      && resolveClassId(item) === selectedDraftClassId
      && resolveAttendanceDate(item) === selectedLessonDate);
    const homeworkResultMatches = candidateHomeworkAssignments.filter((assignment) => {
      const assignmentId = String(assignment.id || '');
      const nestedMatch = selectedStudentKeys.some((key) => homeworkResults?.[key]?.[assignmentId] !== undefined && homeworkResults?.[key]?.[assignmentId] !== null);
      if (nestedMatch) return true;
      return Object.values(homeworkResults || {}).some((value) => {
        if (!value || typeof value !== 'object') return false;
        const byAssignment = value?.[assignmentId];
        if (byAssignment && hasAnyStudentKey([byAssignment.studentId, byAssignment.authUid, byAssignment.studentUid, byAssignment.uid, byAssignment.userUid], selectedStudentKeys)) return true;
        return String(value?.assignmentId || '') === assignmentId
          && hasAnyStudentKey([value.studentId, value.authUid, value.studentUid, value.uid, value.userUid], selectedStudentKeys);
      });
    });
    const gradeMatches = candidateTests.filter((test) => getGradeForLessonReportStudent({
      student: selectedDraftStudent,
      studentId: selectedDraftStudentId,
      grades,
      testId: test.id,
    }));
    console.log('[lesson-report debug:matching]', {
      selectedStudent: selectedDraftStudent,
      studentKeys: selectedStudentKeys,
      counts: {
        candidateAttendanceCount: attendanceMatches.length,
        candidateHomeworkProgressCount: candidateHomeworkAssignments.length,
        candidateAssignedHomeworkCount: classHomeworkAssignments.length,
        candidateTestsCount: candidateTests.length,
        candidateGradesCount: gradeMatches.length,
        candidateHomeworkResultsCount: homeworkResultMatches.length,
      },
      comparedKeysOnEmpty: {
        attendance: attendanceMatches.length ? [] : (attendanceLogs || []).slice(0, 5).map((item) => ({ id: item.id, studentId: item.studentId, studentUid: item.studentUid, classId: resolveClassId(item), date: resolveAttendanceDate(item) })),
        homeworkAssignments: candidateHomeworkAssignments.length ? [] : classHomeworkAssignments.slice(0, 5).map((item) => ({ id: item.id, assignedStudentIds: item.assignedStudentIds, targetStudents: item.targetStudents, classId: resolveClassId(item) })),
        grades: gradeMatches.length ? [] : candidateTests.slice(0, 5).map((test) => ({ testId: test.id, gradeStudentKeys: Object.keys(grades || {}).slice(0, 10) })),
      },
    });
  }, [attendanceLogs, candidateHomeworkAssignments, candidateTests, classHomeworkAssignments, grades, homeworkResults, selectedDraftClassId, selectedDraftStudent, selectedDraftStudentId, selectedLessonDate, selectedStudentKeys]);

  const previewHomeworkSummary = useMemo(
    () => summarizeHomework({
      selectedHomeworkProgressIds: draft?.selectedHomeworkProgressIds || draft?.selectedHomeworkIds || [],
      homeworkAssignments,
      homeworkResults,
      studentId: draft?.studentId,
      student: students.find((item) => String(item.id) === String(draft?.studentId || '')) || null,
    }),
    [draft?.selectedHomeworkIds, draft?.selectedHomeworkProgressIds, draft?.studentId, homeworkAssignments, homeworkResults, students],
  );
  const previewAssignedHomeworkSummary = useMemo(
    () => summarizeAssignedHomework({
      selectedAssignedHomeworkIds: draft?.selectedAssignedHomeworkIds || [],
      homeworkAssignments,
    }),
    [draft?.selectedAssignedHomeworkIds, homeworkAssignments],
  );
  const previewTestSummary = useMemo(
    () => summarizeTests({
      selectedTestIds: draft?.selectedTestIds || [],
      tests,
      grades,
      studentId: draft?.studentId,
      student: students.find((item) => String(item.id) === String(draft?.studentId || '')) || null,
      classTestStats,
    }),
    [classTestStats, draft?.selectedTestIds, draft?.studentId, grades, students, tests],
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !draft) return;
    console.debug('[lesson-report draft] assigned homework', {
      selectedAssignedHomeworkIds: draft.selectedAssignedHomeworkIds || [],
      assignedHomeworkSummary: previewAssignedHomeworkSummary,
    });
  }, [draft, previewAssignedHomeworkSummary]);


  useEffect(() => {
    const selectedTests = (draft?.selectedTestIds || [])
      .map((id) => tests.find((test) => String(test.id) === String(id)))
      .filter(Boolean);
    const selectedStudent = students.find((item) => String(item.id) === String(draft?.studentId || '')) || null;

    console.log('[lesson-report debug:test-summary]', {
      selectedStudentId: draft?.studentId || '',
      selectedTestIds: draft?.selectedTestIds || [],
      gradeKeysForStudent: (() => {
        const studentKeyCandidates = [
          draft?.studentId,
          selectedStudent?.id,
          selectedStudent?.authUid,
          selectedStudent?.studentDocId,
        ].filter(Boolean).map(String);
        const key = studentKeyCandidates.find((candidate) => grades?.[candidate]);
        return key ? Object.keys(grades[key]) : [];
      })(),
      matchedTests: selectedTests,
      matchedGrades: selectedTests.map((test) => ({
        testId: test.id,
        gradeByStudentId: getGradeForLessonReportStudent({
          student: selectedStudent,
          studentId: draft?.studentId,
          grades,
          testId: test.id,
        }),
      })),
    });
  }, [draft?.selectedTestIds, draft?.studentId, grades, students, tests]);

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
      const studentKeys = buildStudentKeys(student);
      const attendance = attendanceLogs.find((item) => hasAnyStudentKey([item.studentId, item.studentUid], studentKeys)
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
        selectedHomeworkProgressIds: existingReport?.selectedHomeworkProgressIds || existingReport?.selectedHomeworkIds || [],
        selectedAssignedHomeworkIds: existingReport?.selectedAssignedHomeworkIds || [],
        selectedTestIds: existingReport?.selectedTestIds || getTestsForStudent({ tests, grades, student, studentId: targetStudentId, classId, lessonDate })
          .filter((test) => isTestHeldOnLessonDate(test, lessonDate))
          .map((item) => item.id)
          .filter(Boolean),
        comment: existingReport?.comment || '',
        status: existingReport?.status || LESSON_REPORT_STATUS.DRAFT,
        sendStatus: existingReport?.sendStatus || LESSON_REPORT_SEND_STATUS.DRAFT,
        sendMode: existingReport?.sendMode || 'now',
        scheduledSendAt: existingReport?.scheduledSendAt || null,
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
      const nextStudent = students.find((item) => String(item.id) === nextStudentId) || null;
      const nextStudentKeys = buildStudentKeys(nextStudent);
      const attendance = attendanceLogs.find((item) => hasAnyStudentKey([item.studentId, item.studentUid], nextStudentKeys)
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
          selectedHomeworkProgressIds: existing.selectedHomeworkProgressIds || existing.selectedHomeworkIds || [],
          selectedAssignedHomeworkIds: existing.selectedAssignedHomeworkIds || [],
          autoFilledLearnedTopics: resolveLessonLogProgress(lessonLog),
          isLearnedTopicsManuallyEdited: false,
        };
      }

        return {
        ...prev,
        ...changes,
        id: nextId,
        studentId: nextStudentId,
        classId: nextClassId,
        lessonDate: nextLessonDate,
        status: LESSON_REPORT_STATUS.DRAFT,
        sendStatus: LESSON_REPORT_SEND_STATUS.DRAFT,
        sendMode: 'now',
        scheduledSendAt: null,
        attendanceStatus: changes.attendanceStatus ?? prev.attendanceStatus ?? attendance?.attendance ?? attendance?.status ?? '미기록',
        lessonLogId: lessonLog?.id || null,
        autoFilledLearnedTopics: resolveLessonLogProgress(lessonLog),
        learnedTopics: prev.isLearnedTopicsManuallyEdited ? prev.learnedTopics : (resolveLessonLogProgress(lessonLog) || prev.learnedTopics || ''),
        selectedTestIds: getTestsForStudent({ tests, grades, student: nextStudent, studentId: nextStudentId, classId: nextClassId, lessonDate: nextLessonDate })
          .filter((test) => isTestHeldOnLessonDate(test, nextLessonDate))
          .map((item) => item.id)
          .filter(Boolean),
      };
    });
  };

  const toDraftForSend = (report) => ({
    ...report,
    status: report?.status || LESSON_REPORT_STATUS.DRAFT,
    sendStatus: report?.sendStatus || LESSON_REPORT_SEND_STATUS.DRAFT,
  });

  const buildPayload = ({ reportDraft, previous, action }) => {
    const student = students.find((item) => String(item.id) === String(reportDraft.studentId));
    const canonicalStudentId = String(student?.id || reportDraft.studentId || '').trim();
    const canonicalClassId = String(reportDraft.classId || '').trim();
    const canonicalLessonDate = toYmd(reportDraft.lessonDate);
    const canonicalReportId = buildLessonReportId({
      studentId: canonicalStudentId,
      classId: canonicalClassId,
      lessonDate: canonicalLessonDate,
    }) || String(reportDraft.id || '').trim();
    const now = serverTimestamp();
    const isScheduled = action === 'schedule';
    const isSendNow = action === 'send';
    const isFirstSend = isSendNow && previous?.status !== LESSON_REPORT_STATUS.SENT;

    const homeworkSummary = summarizeHomework({
      selectedHomeworkProgressIds: reportDraft.selectedHomeworkProgressIds || reportDraft.selectedHomeworkIds,
      homeworkAssignments,
      homeworkResults,
      studentId: reportDraft.studentId,
      student,
    });
    const assignedHomeworkSummary = summarizeAssignedHomework({
      selectedAssignedHomeworkIds: reportDraft.selectedAssignedHomeworkIds || [],
      homeworkAssignments,
    });
    const testSummary = summarizeTests({
      selectedTestIds: reportDraft.selectedTestIds,
      tests,
      grades,
      studentId: reportDraft.studentId,
      student,
      classTestStats,
    });

    const payload = {
      ...reportDraft,
      id: canonicalReportId,
      studentId: canonicalStudentId,
      classId: canonicalClassId,
      lessonDate: canonicalLessonDate,
      selectedHomeworkProgressIds: reportDraft.selectedHomeworkProgressIds || reportDraft.selectedHomeworkIds || [],
      selectedAssignedHomeworkIds: reportDraft.selectedAssignedHomeworkIds || [],
      selectedHomeworkIds: Array.from(new Set([
        ...(reportDraft.selectedHomeworkProgressIds || []),
        ...(reportDraft.selectedAssignedHomeworkIds || []),
        ...(reportDraft.selectedHomeworkIds || []),
      ])),
      homeworkSummary,
      assignedHomeworkSummary,
      testSummary,
      status: isSendNow ? LESSON_REPORT_STATUS.SENT : (previous?.status || LESSON_REPORT_STATUS.DRAFT),
      isModified: action === 'save' ? true : Boolean(reportDraft.isModified || previous?.isModified),
      sendStatus: isSendNow
        ? LESSON_REPORT_SEND_STATUS.SENT
        : (isScheduled ? LESSON_REPORT_SEND_STATUS.SCHEDULED : LESSON_REPORT_SEND_STATUS.DRAFT),
      sendMode: isScheduled ? 'scheduled' : 'now',
      scheduledSendAt: isScheduled ? new Date(scheduledSendAt) : null,
      scheduledBy: isScheduled ? (profileDocId || 'staff') : null,
      updatedAt: now,
      updatedBy: profileDocId || 'staff',
      createdAt: previous?.createdAt || now,
      createdBy: previous?.createdBy || profileDocId || 'staff',
      sentAt: previous?.sentAt || (isFirstSend ? now : null),
      sentBy: previous?.sentBy || (isFirstSend ? (profileDocId || 'staff') : null),
      lastEditedAfterSentAt: previous?.status === LESSON_REPORT_STATUS.SENT ? now : null,
    };

    delete payload.autoFilledLearnedTopics;
    delete payload.isLearnedTopicsManuallyEdited;
    return { payload, student, isFirstSend };
  };

  const resolveUserAuthUidById = async (userId) => {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) return '';

    try {
      const userSnap = await getDoc(doc(db, 'users', normalizedUserId));
      if (!userSnap.exists()) return normalizedUserId;
      const userData = userSnap.data() || {};
      return String(userData.authUid || userData.userUid || userData.uid || normalizedUserId).trim();
    } catch (error) {
      console.debug('[notifications] lesson report user auth lookup failed', { userId: normalizedUserId, error });
      return normalizedUserId;
    }
  };

  const notifyForFirstSend = async ({ reportDraft, student }) => {
    console.debug('[notifications] notifyForFirstSend called', {
      reportId: reportDraft?.id,
      studentId: reportDraft?.studentId,
      notificationSendingEnabled: FEATURES.ENABLE_NOTIFICATION_SENDING,
    });

    if (!FEATURES.ENABLE_NOTIFICATION_SENDING) {
      console.debug('[notifications] lesson report skipped: notification_disabled');
      return { success: true, sent: false, skipped: true, reason: 'notification_disabled' };
    }

    const studentAuthCandidates = [
      student?.authUid,
      student?.userUid,
      student?.uid,
    ].filter(Boolean).map(String);

    const directParentCandidates = [
      student?.parentAuthUid,
      student?.parentAuthUids,
      student?.parentUid,
      student?.parentUids,
      student?.parentIds,
    ].flat().filter(Boolean).map(String);
    const linkedParentCandidates = getLinkedParentAuthUids(student, []);
    const parentAuthCandidates = Array.from(new Set([...directParentCandidates, ...linkedParentCandidates]));
    const resolvedParentAuthUids = (await Promise.all(parentAuthCandidates.map(resolveUserAuthUidById))).filter(Boolean);

    const targetAuthUids = Array.from(new Set([
      ...studentAuthCandidates,
      ...resolvedParentAuthUids,
    ].map((value) => String(value || '').trim()).filter(Boolean)));

    console.debug('[notifications] student auth candidates', studentAuthCandidates);
    console.debug('[notifications] parent auth candidates', { directParentCandidates, linkedParentCandidates, resolvedParentAuthUids });
    console.debug('[notifications] final targetAuthUids', targetAuthUids);

    await Promise.all(targetAuthUids.map(async (uid) => {
      try {
        await addDoc(collection(db, 'notifications', uid, 'items'), {
          type: 'lesson_report',
          category: 'lessonReport',
          refCollection: 'lessonReports',
          refId: reportDraft.id,
          ref: `lessonReports/${reportDraft.id}`,
          title: '새 수업 리포트가 도착했습니다.',
          body: `${student?.name || '학생'} 학생의 수업 리포트가 도착했습니다.`,
          isRead: false,
          createdAt: serverTimestamp(),
          payload: {
            reportId: reportDraft.id,
            studentId: reportDraft.studentId,
            classId: reportDraft.classId,
            lessonDate: reportDraft.lessonDate,
            type: 'lesson_report',
            refCollection: 'lessonReports',
          },
        });
        console.debug('[notifications] add notification success', { uid, reportId: reportDraft.id });
      } catch (error) {
        console.error('[notifications] add notification failure', { uid, reportId: reportDraft.id, error });
        throw error;
      }
    }));

    await setDoc(
      doc(db, 'lessonReports', reportDraft.id),
      {
        studentNotificationSent: studentAuthCandidates.length > 0,
        parentNotificationSent: resolvedParentAuthUids.length > 0,
      },
      { merge: true },
    );
  };

  const persistReport = async ({ reportDraft, action, closeDraft = true }) => {
    if (!reportDraft?.id) throw new Error('리포트 ID가 없어 저장할 수 없습니다.');
    const draftKey = buildLessonReportId({ studentId: reportDraft.studentId, classId: reportDraft.classId, lessonDate: toYmd(reportDraft.lessonDate) }) || reportDraft.id;
    const previous = reportMap.get(draftKey) || reportMap.get(reportDraft.id);
    const isCreate = !previous;
    const { payload, student, isFirstSend } = buildPayload({ reportDraft, previous, action });
    if (process.env.NODE_ENV === 'development') {
      console.debug('[lesson-report save] payload', {
        reportId: payload.id,
        payloadId: payload.id,
        studentId: payload.studentId,
        classId: payload.classId,
        lessonDate: payload.lessonDate,
        status: payload.status,
        sendStatus: payload.sendStatus,
        selectedAssignedHomeworkIds: payload.selectedAssignedHomeworkIds,
        assignedHomeworkSummary: payload.assignedHomeworkSummary,
      });
    }

    await setDoc(doc(db, 'lessonReports', payload.id), payload, { merge: true });

    if (isFirstSend && action === 'send') {
      await notifyForFirstSend({ reportDraft: payload, student });
    }

    setLocalReportMap((prev) => ({ ...prev, [payload.id]: payload }));

    if (closeDraft) {
      setDraft(null);
    } else {
      setDraft(payload);
    }
    setDraftError('');
  };

  const saveReport = async () => {
    if (!draft) return;
    setReportSaving(true);
    try {
      await persistReport({ reportDraft: draft, action: 'save', closeDraft: false });
    } catch (error) {
      setDraftError(error?.message || '수업 리포트 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setReportSaving(false);
    }
  };

  const sendReport = async ({ reportDraft, closeDraft = true }) => {
    if (!reportDraft) return;
    const action = sendMode === 'scheduled' ? 'schedule' : 'send';
    if (action === 'schedule' && !scheduledSendAt) {
      throw new Error('예약 전송 시간을 입력해 주세요.');
    }
    await persistReport({ reportDraft, action, closeDraft });
  };


  const buildAutoDraftForStudent = (student) => {
    const classId = String(selectedClassId || '');
    const lessonDate = String(selectedDate || todayYmd());
    const reportId = buildLessonReportId({ studentId: student.id, classId, lessonDate });
    const lessonLog = getLessonLogForClassDate({ lessonLogs, classId, lessonDate });
    const attendance = getAttendanceForStudent({ attendanceLogs, student, classId, lessonDate });
    const selectedHomeworkProgressIds = getHomeworkAssignmentsForStudent({ homeworkAssignments, student, classId, lessonDate, onlyTargeted: true })
      .filter((assignment) => getHomeworkFilterReason({
        assignment,
        lessonDate,
        student,
        studentId: student.id,
        homeworkResults,
      }) === 'included')
      .map((item) => item.id)
      .filter(Boolean);
    const selectedAssignedHomeworkIds = getHomeworkAssignmentsForStudent({ homeworkAssignments, student, classId, lessonDate, onlyTargeted: false })
      .filter((assignment) => isHomeworkAssignedOnLessonDate(assignment, lessonDate))
      .map((item) => item.id)
      .filter(Boolean);
    const selectedTestIds = getTestsForStudent({ tests, grades, student, studentId: student.id, classId, lessonDate })
      .filter((test) => isTestHeldOnLessonDate(test, lessonDate))
      .map((item) => item.id)
      .filter(Boolean);
    const reportDraft = {
      id: reportId,
      studentId: String(student.id),
      classId,
      lessonDate,
      lessonLogId: lessonLog?.id || null,
      attendanceStatus: attendance?.attendance || attendance?.status || '미기록',
      learnedTopics: resolveLessonLogProgress(lessonLog),
      selectedHomeworkProgressIds,
      selectedAssignedHomeworkIds,
      selectedHomeworkIds: Array.from(new Set([...selectedHomeworkProgressIds, ...selectedAssignedHomeworkIds])),
      selectedTestIds,
      status: LESSON_REPORT_STATUS.DRAFT,
      sendStatus: LESSON_REPORT_SEND_STATUS.DRAFT,
      sendMode: 'now',
      scheduledSendAt: null,
      studentNotificationSent: false,
      parentNotificationSent: false,
      isBulkDraftGenerated: true,
      isModified: false,
      autoInputStatus: {
        attendance: Boolean(attendance),
        homework: selectedHomeworkProgressIds.length > 0 || selectedAssignedHomeworkIds.length > 0,
        test: selectedTestIds.length > 0,
      },
    };
    const homeworkSummary = summarizeHomework({ selectedHomeworkProgressIds, homeworkAssignments, homeworkResults, studentId: student.id, student });
    return {
      ...reportDraft,
      homeworkSummary,
      assignedHomeworkSummary: summarizeAssignedHomework({ selectedAssignedHomeworkIds, homeworkAssignments }),
      testSummary: summarizeTests({ selectedTestIds, tests, grades, studentId: student.id, student, classTestStats }),
      comment: '',
    };
  };

  const handleCreateClassDrafts = async () => {
    if (!selectedClassId || !selectedDate) {
      setDraftError('클래스와 날짜를 먼저 선택해 주세요.');
      return;
    }
    setBulkDraftCreating(true);
    setDraftError('');
    try {
      const now = serverTimestamp();
      const draftsToCreate = classStudents
        .map((student) => buildAutoDraftForStudent(student))
        .filter((reportDraft) => reportDraft.id && !reportMap.has(reportDraft.id));

      for (let index = 0; index < draftsToCreate.length; index += 500) {
        const batch = writeBatch(db);
        draftsToCreate.slice(index, index + 500).forEach((reportDraft) => {
          batch.set(doc(db, 'lessonReports', reportDraft.id), {
            ...reportDraft,
            createdAt: now,
            createdBy: profileDocId || 'staff',
            updatedAt: now,
            updatedBy: profileDocId || 'staff',
            autoGeneratedAt: now,
          });
        });
        await batch.commit();
      }

      setLocalReportMap((prev) => draftsToCreate.reduce((acc, reportDraft) => ({
        ...acc,
        [reportDraft.id]: {
          ...reportDraft,
          createdBy: profileDocId || 'staff',
          updatedBy: profileDocId || 'staff',
        },
      }), { ...prev }));
      const createdIdSet = new Set(draftsToCreate.map((item) => item.id));
      setSelectedStudentIdsForBulk(classStudents.filter((student) => {
        const reportId = buildLessonReportId({ studentId: student.id, classId: selectedClassId, lessonDate: selectedDate });
        const report = createdIdSet.has(reportId) ? { status: LESSON_REPORT_STATUS.DRAFT } : reportMap.get(reportId);
        return canSelectForBulkSend(report);
      }).map((student) => student.id));
      setDraftError(draftsToCreate.length === 0 ? '새로 생성할 초안이 없습니다. 기존 리포트는 변경하지 않았습니다.' : `${draftsToCreate.length}명의 초안을 생성했습니다. 기존 리포트는 변경하지 않았습니다.`);
    } catch (error) {
      setDraftError(error?.message || '반 전체 초안 생성 중 오류가 발생했습니다.');
    } finally {
      setBulkDraftCreating(false);
    }
  };

  const selectedClassName = availableClasses.find((item) => String(item.id) === String(draft?.classId || selectedClassId))?.name || '';
  const isScheduledMode = sendMode === 'scheduled';

  const canSelectForBulkSend = (report) => Boolean(report) && report?.status !== LESSON_REPORT_STATUS.SENT;

  const toggleStudentForBulk = (studentId) => {
    setSelectedStudentIdsForBulk((prev) => (
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    ));
  };

  const handleBulkSend = async () => {
    if (selectedStudentIdsForBulk.length === 0) {
      setDraftError('일괄 전송할 학생을 선택해 주세요.');
      return;
    }
    if (isScheduledMode && !scheduledSendAt) {
      setDraftError('예약 전송 시간을 입력해 주세요.');
      return;
    }

    setReportSaving(true);
    setDraftError('');

    try {
      const failures = [];
      const sentReports = [];
      for (const studentId of selectedStudentIdsForBulk) {
        const reportId = buildLessonReportId({ studentId, classId: selectedClassId, lessonDate: selectedDate });
        const report = reportMap.get(reportId);
        if (!report) {
          failures.push(`${studentId}: 초안 없음`);
          continue;
        }
        if (report.status === LESSON_REPORT_STATUS.SENT) {
          continue;
        }
        const reportDraft = toDraftForSend(report);
        await sendReport({ reportDraft, closeDraft: false });
        if (!isScheduledMode) sentReports.push(reportDraft);
      }

      if (sentReports.length > 0) {
        const assignmentLessonDateMap = new Map();
        sentReports.forEach((report) => {
          (report.selectedHomeworkProgressIds || []).filter(Boolean).forEach((assignmentId) => {
            const key = String(assignmentId);
            if (!assignmentLessonDateMap.has(key)) {
              assignmentLessonDateMap.set(key, report.lessonDate || selectedDate);
            }
          });
        });
        const pendingAssignmentIds = Array.from(assignmentLessonDateMap.keys()).filter((assignmentId) => {
          const assignment = (homeworkAssignments || []).find((item) => String(item.id) === assignmentId);
          return !assignment || isPendingHomeworkInspection(assignment);
        });
        for (let index = 0; index < pendingAssignmentIds.length; index += 500) {
          const batch = writeBatch(db);
          pendingAssignmentIds.slice(index, index + 500).forEach((assignmentId) => {
            batch.update(doc(db, 'homeworkAssignments', assignmentId), {
              inspectionStatus: 'completed',
              checkedLessonDate: assignmentLessonDateMap.get(assignmentId) || selectedDate,
              checkedAt: serverTimestamp(),
              checkedBy: profileDocId || user?.uid || 'staff',
            });
          });
          await batch.commit();
        }
      }

      if (failures.length > 0) {
        setDraftError(`일부 전송 실패 - ${failures.join(', ')}`);
      }
      setSelectedStudentIdsForBulk([]);
    } catch (error) {
      setDraftError(error?.message || '일괄 전송 중 오류가 발생했습니다.');
    } finally {
      setReportSaving(false);
    }
  };

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
            {availableClasses.map((cls) => <option key={cls.id} value={cls.id}>{formatClassLabel(cls)}</option>)}
          </select>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value || todayYmd())} className="border rounded p-2 text-sm" />
          <div className="text-sm text-gray-600 flex items-center">총 {classStudents.length}명</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={sendMode} onChange={(e) => setSendMode(e.target.value)} className="border rounded p-2 text-sm">
            <option value="now">즉시 전송</option>
            <option value="scheduled">예약 전송</option>
          </select>
          {isScheduledMode && (
            <input
              type="datetime-local"
              value={scheduledSendAt}
              onChange={(e) => setScheduledSendAt(e.target.value)}
              className="border rounded p-2 text-sm"
            />
          )}
          <button
            className="px-3 py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
            onClick={handleCreateClassDrafts}
            disabled={reportSaving || bulkDraftCreating || !selectedClassId || !selectedDate || classStudents.length === 0}
          >
            {bulkDraftCreating ? '초안 생성 중...' : '반 전체 초안 생성'}
          </button>
          <button
            className="px-3 py-2 rounded bg-[#455fab] text-white text-sm disabled:opacity-50"
            onClick={handleBulkSend}
            disabled={reportSaving || bulkDraftCreating || selectedStudentIdsForBulk.length === 0}
          >
            선택한 리포트 전송 ({selectedStudentIdsForBulk.length})
          </button>
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
                <th className="text-left px-3 py-2">선택</th>
                <th className="text-left px-3 py-2">학생명</th>
                <th className="text-left px-3 py-2">상태</th>
                <th className="text-left px-3 py-2">발송 여부</th>
                <th className="text-left px-3 py-2">자동 입력</th>
                <th className="text-right px-3 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.map((student) => {
                const reportId = buildLessonReportId({ studentId: student.id, classId: selectedClassId, lessonDate: selectedDate });
                const report = reportMap.get(reportId);
                return (
                  <tr key={student.id} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedStudentIdsForBulk.includes(student.id)}
                        onChange={() => toggleStudentForBulk(student.id)}
                        disabled={!canSelectForBulkSend(report) || reportSaving}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">{student.name || student.id}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClassName(report?.status, report?.sendStatus, report?.scheduledSendAt)}`}>
                        {statusLabel(report?.status, report?.sendStatus, report?.scheduledSendAt, report?.isModified)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{report?.status === LESSON_REPORT_STATUS.SENT ? '발송됨' : (report?.sendStatus === LESSON_REPORT_SEND_STATUS.SCHEDULED ? '예약됨' : '미발송')}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {report ? (
                        <div className="flex flex-wrap gap-1">
                          <span>{report.autoInputStatus?.attendance ? '✓ 출결' : '⚠ 출결 없음'}</span>
                          <span>{report.autoInputStatus?.homework ? '✓ 숙제' : '⚠ 숙제 없음'}</span>
                          <span>{report.autoInputStatus?.test ? '✓ 시험' : '⚠ 시험 없음'}</span>
                        </div>
                      ) : '초안 없음'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="px-3 py-1.5 rounded bg-[#455fab] text-white text-xs"
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
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
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
                <button className={`px-3 py-1.5 text-sm ${activeTab === 'edit' ? 'bg-[#455fab] text-white' : 'bg-white text-gray-700'}`} onClick={() => setActiveTab('edit')}>편집</button>
                <button className={`px-3 py-1.5 text-sm ${activeTab === 'preview' ? 'bg-[#455fab] text-white' : 'bg-white text-gray-700'}`} onClick={() => setActiveTab('preview')}>미리보기</button>
              </div>
              </div>

            {activeTab === 'edit' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <select value={draft.studentId} onChange={(e) => handleDraftSelectionChange({ studentId: e.target.value })} className="border rounded p-2 text-sm">
                    {classStudents.map((student) => <option key={student.id} value={student.id}>{student.name || student.id}</option>)}
                  </select>
                  <select value={draft.classId} onChange={(e) => handleDraftSelectionChange({ classId: e.target.value })} className="border rounded p-2 text-sm">
                    {availableClasses.map((cls) => <option key={cls.id} value={cls.id}>{formatClassLabel(cls)}</option>)}
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
                  <p className="text-sm font-semibold mb-1">과제 수행 정도 선택</p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {selectableHomeworkProgress.map((hw) => (
                      <label key={hw.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(draft.selectedHomeworkProgressIds || []).includes(hw.id)}
                          onChange={(e) => setDraft((prev) => ({
                            ...prev,
                            selectedHomeworkProgressIds: e.target.checked
                              ? [...(prev.selectedHomeworkProgressIds || []), hw.id]
                              : (prev.selectedHomeworkProgressIds || []).filter((id) => id !== hw.id),
                          }))}
                        />
                        <span>{resolveHomeworkAssignmentTitle(hw)}{getHomeworkResultForStudentAssignment({ homeworkResults, assignmentId: hw.id, student: selectedDraftStudent, studentId: selectedDraftStudentId }) ? ' · 결과 있음' : (isPendingHomeworkInspection(hw) ? ' · 검사 대기' : ' · 검사 완료')}</span>
                      </label>
                    ))}
                    {selectableHomeworkProgress.length === 0 && (
                      <p className="text-xs text-gray-500">선택 가능한 과제 수행 항목 없음</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">이번 수업 숙제 선택</p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {selectableAssignedHomework.map((hw) => (
                      <label key={`assigned-${hw.id}`} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(draft.selectedAssignedHomeworkIds || []).includes(hw.id)}
                          onChange={(e) => setDraft((prev) => ({
                            ...prev,
                            selectedAssignedHomeworkIds: e.target.checked
                              ? [...(prev.selectedAssignedHomeworkIds || []), hw.id]
                              : (prev.selectedAssignedHomeworkIds || []).filter((id) => id !== hw.id),
                          }))}
                        />
                        {resolveHomeworkAssignmentTitle(hw)}
                      </label>
                    ))}
                    {selectableAssignedHomework.length === 0 && (
                      <p className="text-xs text-gray-500">선택 가능한 숙제 항목 없음</p>
                    )}
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
                  <button className="px-3 py-2 rounded bg-[#eef2ff] text-[#334a91]" onClick={saveReport} disabled={reportSaving}>저장</button>
                  <button
                    className="px-3 py-2 rounded bg-[#455fab] text-white"
                    onClick={async () => {
                      setReportSaving(true);
                      try {
                        await sendReport({ reportDraft: draft, closeDraft: false });
                      } catch (error) {
                        setDraftError(error?.message || '리포트 전송에 실패했습니다.');
                      } finally {
                        setReportSaving(false);
                      }
                    }}
                    disabled={reportSaving}
                  >
                    {isScheduledMode ? '예약 전송' : '발송'}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border bg-gray-50 p-4 space-y-3 text-sm">
                <h3 className="font-semibold text-base">수업 리포트 미리보기</h3>
                <p><span className="font-semibold">수업일 / 클래스:</span> {draft.lessonDate} / {availableClasses.find((item) => String(item.id) === String(draft.classId))?.name || draft.classId}</p>
                {draft.learnedTopics && <p><span className="font-semibold">진도:</span> {draft.learnedTopics}</p>}
                {draft.attendanceStatus && <p><span className="font-semibold">출결:</span> {draft.attendanceStatus}</p>}
                {previewHomeworkSummary.text?.length > 0 && <p><span className="font-semibold">과제 수행 정도:</span> {previewHomeworkSummary.text.join(', ')}</p>}
                {previewTestSummary.text?.length > 0 && (
                  <div>
                    <p className="font-semibold">시험</p>
                    <ul className="list-disc pl-5">
                      {previewTestSummary.text.map((line, index) => (
                        <li key={`preview-test-${index}`} className="whitespace-pre-line">{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
