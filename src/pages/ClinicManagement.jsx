import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../utils/helpers';
import { db } from '../firebase/client';
import { fetchClinicLogsDeepForStaff, fetchClinicLogsPaged } from '../data/firestoreSync';
import { ClinicScheduleModal } from '../utils/modals/ClinicScheduleModal';
import { ClinicCommentModal } from '../utils/modals/ClinicCommentModal';
import { ClinicNotificationModal } from '../utils/modals/ClinicNotificationModal';
import { ClinicBulkNotificationModal } from '../utils/modals/ClinicBulkNotificationModal';
import { buildStudentParentPhoneLast4Map } from '../utils/parentPhone';
import StudentNameWithParentLast4 from '../components/common/StudentNameWithParentLast4';
import useAuth from '../auth/useAuth';
import { createStaffTimelineThread, fetchClinicTimelineThreads } from '../domain/staffTimeline/staffTimeline.service';
import StaffTimelineThreadCard from '../components/StaffTimeline/StaffTimelineThreadCard';

export default function ClinicManagement({ 
    students, parents = [], classes, handleSaveClinicLog, handleDeleteClinicLog,
    logNotification, userRole
}) {
    const [filterMode, setFilterMode] = useState('all'); // all | date
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [viewMode, setViewMode] = useState('staff'); // staff | tutor
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedAssistantId, setSelectedAssistantId] = useState('');
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;

    // 모달 상태
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [isBulkNotifyModalOpen, setIsBulkNotifyModalOpen] = useState(false);
    
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedLogIds, setSelectedLogIds] = useState([]);
    const [selectedNotificationType, setSelectedNotificationType] = useState('comment'); 
    const [openStaffMemoLogId, setOpenStaffMemoLogId] = useState('');
    const [staffMemoDrafts, setStaffMemoDrafts] = useState({});
    const [savingStaffMemoLogId, setSavingStaffMemoLogId] = useState('');
    const [clinicTimelineItems, setClinicTimelineItems] = useState([]);
    const [clinicTimelineError, setClinicTimelineError] = useState('');
    const [pagedLogs, setPagedLogs] = useState([]);
    const [deepLogs, setDeepLogs] = useState([]);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const FETCH_PAGE_SIZE = 50;
    const { user, userProfile } = useAuth();

    const debugSampleLoggedRef = useRef(false);

    const currentUserFallbackName = userProfile?.email || user?.email ? (userProfile?.email || user?.email).split('@')[0] : '';
    const currentUserName = userProfile?.displayName?.trim()
        || userProfile?.name?.trim()
        || user?.displayName?.trim()
        || currentUserFallbackName
        || '교직원';
    const currentSenderRole = userProfile?.role || userProfile?.type || userRole || 'staff';
    const timelineActor = useMemo(() => ({
        uid: user?.uid || '',
        name: currentUserName,
        role: currentSenderRole,
    }), [currentSenderRole, currentUserName, user?.uid]);

    useEffect(() => {
        console.log('[DEBUG] students =', students?.slice(0, 3));
        console.log('[DEBUG] parents =', parents?.slice(0, 3));
        console.log('[DEBUG] pagedLogs =', pagedLogs?.slice(0, 3));
    }, [students, parents, pagedLogs]);

    useEffect(() => {
        console.log('[clinic management] pagedLogs loaded =', pagedLogs.length);
        if (pagedLogs.length > 0) {
            console.log('[clinic management] effectiveDate sample', pagedLogs.slice(0, 30).map((log) => ({
                id: log.id,
                effectiveDate: log.effectiveDate,
                date: log.date,
                clinicDate: log.clinicDate,
                createdAt: log.createdAt,
            })));
        }
    }, [pagedLogs]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const today = new Date();
            const before90 = new Date();
            before90.setDate(today.getDate() - 90);

            const fromDate = before90.toISOString().slice(0, 10);

            const { docs, lastDoc: initialLastDoc } = await fetchClinicLogsPaged({
                db,
                pageSize: FETCH_PAGE_SIZE,
                fromDate,
            });

            if (cancelled) return;

            setPagedLogs(docs);
            setLastDoc(initialLastDoc);
            setHasMore(docs.length === FETCH_PAGE_SIZE);
        };

        load();
        return () => { cancelled = true; };
    }, []);

    const needsDeepLoad = useMemo(() => {
        if (filterMode === 'date') return true;
        return Boolean(
            String(selectedClassId || '').trim()
            || String(selectedAssistantId || '').trim()
            || String(searchText || '').trim()
            || String(rangeFrom || '').trim()
            || String(rangeTo || '').trim(),
        );
    }, [filterMode, selectedClassId, selectedAssistantId, searchText, rangeFrom, rangeTo]);

    const deepKey = useMemo(() => {
        const modeKey = filterMode;
        const clsKey = selectedClassId || '';
        const stuKey = '';
        const dateKey = filterMode === 'date' ? (selectedDate || '') : '';
        const stKey = searchText || '';
        return `${modeKey}|c:${clsKey}|s:${stuKey}|d:${dateKey}|q:${stKey}|f:${rangeFrom || ''}|t:${rangeTo || ''}`;
    }, [filterMode, selectedClassId, selectedDate, searchText, rangeFrom, rangeTo]);

    useEffect(() => {
        let cancelled = false;

        const loadDeep = async () => {
            if (!needsDeepLoad) {
                setDeepLogs([]);
                return;
            }

            const selectedClassName = selectedClassId
                ? (classes.find(c => String(c.id) === String(selectedClassId))?.name || '')
                : '';

            const deep = await fetchClinicLogsDeepForStaff({
                db,
                classId: selectedClassId || '',
                className: selectedClassName,
                studentId: '',
                date: filterMode === 'date' ? (selectedDate || '') : '',
                from: filterMode === 'all' ? (rangeFrom || '') : '',
                to: filterMode === 'all' ? (rangeTo || '') : '',
                pageSize: 500,
                maxDocs: 5000,
                isCancelled: () => cancelled,
            });

            if (cancelled) return;
            console.log('[clinic] deep clinicLogs loaded =', deep.length);
            setDeepLogs(deep);
        };

        loadDeep();
        return () => { cancelled = true; };
    }, [needsDeepLoad, deepKey, selectedClassId, classes, filterMode, selectedDate, rangeFrom, rangeTo]);

    const handleLoadMore = useCallback(async () => {
        if (!hasMore || !lastDoc) return;

        const { docs, lastDoc: newLast } = await fetchClinicLogsPaged({
            db,
            pageSize: FETCH_PAGE_SIZE,
            lastDoc,
        });

        setPagedLogs(prev => [...prev, ...docs]);
        setLastDoc(newLast);
        setHasMore(docs.length === FETCH_PAGE_SIZE);
    }, [hasMore, lastDoc]);

    const activeClinicLogs = needsDeepLoad ? deepLogs : pagedLogs;

    const studentIndex = useMemo(() => {
        const m = new Map();
        (students || []).forEach((s) => {
            if (!s) return;
            const keys = [s.id, s.uid, s.authUid, s.studentDocId].filter(Boolean).map(String);
            keys.forEach((k) => { if (!m.has(k)) m.set(k, s); });
        });
        return m;
    }, [students]);

    const parentLast4Map = useMemo(
        () => buildStudentParentPhoneLast4Map(students, parents),
        [students, parents],
    );

    useEffect(() => {
        console.log('[clinic] students=', (students || []).length, 'parents=', (parents || []).length);
        console.log('[clinic] sample student keys=', (students || [])[0] ? Object.keys((students || [])[0]) : null);
        console.log('[clinic] sample parent keys=', (parents || [])[0] ? Object.keys((parents || [])[0]) : null);
    }, [students, parents]);


    const classById = useMemo(() => {
        return new Map(classes.map(item => [item.id, item]));
    }, [classes]);

    const classOptions = useMemo(() => {
        return classes
            .map(item => ({ id: item.id, name: item.name }))
            .filter(item => item.id && item.name)
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ko'));
    }, [classes]);

    const assistantOptions = useMemo(() => {
        const seen = new Map();
        activeClinicLogs.forEach(log => {
            const id = log.assistantId || log.tutorId || '';
            const name = log.tutor || log.assistantName || log.assistant?.name || '';
            const key = id || name;
            if (!key || !name) return;
            if (!seen.has(key)) {
                seen.set(key, { id: id || name, name });
            }
        });

        return Array.from(seen.values()).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ko'));
    }, [activeClinicLogs]);

    const studentOptions = useMemo(() => {
        return (students || [])
            .filter((s) => s?.id && s?.name)
            .map((s) => {
                const parentLast4 = parentLast4Map[String(s.id)] || '';
                const suffix = parentLast4 ? `(${parentLast4})` : '';
                const className = classes.find((c) => String(c.id) === String((s.classes || [])[0]))?.name || '';
                return {
                    id: s.id,
                    name: s.name,
                    parentLast4,
                    label: [s.name, suffix].filter(Boolean).join(' '),
                    className,
                };
            })
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ko'));
    }, [students, classes, parentLast4Map]);

    const normalizeClassId = useCallback((value) => {
        if (!value) return '';
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number') return String(value);
        if (value?.id) return String(value.id);
        if (value?.path && typeof value.path === 'string') {
            const parts = value.path.split('/');
            return parts[parts.length - 1] || '';
        }
        return String(value).trim();
    }, []);

    const normalizeSelectedClassId = useCallback((selected, classList) => {
        if (!selected) return '';
        const matchedById = classList.find(item => String(item.id) === String(selected));
        if (matchedById) return String(matchedById.id);
        const matchedByName = classList.find(item => String(item.name) === String(selected));
        return matchedByName ? String(matchedByName.id) : String(selected);
    }, []);

    const getItemClassId = useCallback((item, classList) => {
        const candidates = [
            item?.classId,
            item?.classDocId,
            item?.class?.id,
            item?.class?.classId,
            item?.class?.docId,
            item?.class?.classDocId,
            item?.classRef,
            item?.class?.ref,
        ];

        for (const candidate of candidates) {
            const value = normalizeClassId(candidate);
            if (value) return value;
        }

        if (item?.className) {
            const matched = classList.find(cls => String(cls.name) === String(item.className));
            return matched ? String(matched.id) : '';
        }
        return '';
    }, [normalizeClassId]);

    const resolveStudentFromLog = useCallback((log) => {
        const candidates = [
            log?.studentDocId,
            log?.studentId,
            log?.studentUid,
            log?.authUid,
            log?.student?.id,
            log?.student?.uid,
            log?.student?.authUid,
        ].filter(Boolean).map(String);

        for (const k of candidates) {
            const found = studentIndex.get(k);
            if (found) return found;
        }
        return null;
    }, [studentIndex]);

    const getParentLast4ForStudent = useCallback((student) => {
        if (!student) return '';
        const keys = [student.id, student.uid, student.authUid, student.studentDocId].filter(Boolean).map(String);
        for (const k of keys) {
            const v = parentLast4Map[String(k)] || '';
            if (v) return v;
        }
        return '';
    }, [parentLast4Map]);

    const getStudentName = useCallback((log) => {
        if (log?.studentName) return log.studentName;
        const st = resolveStudentFromLog(log);
        return st?.name || '';
    }, [resolveStudentFromLog]);

    const getClassName = useCallback((log) => {
        if (log.className) return log.className;
        const classInfo = classById.get(log.classId);
        return classInfo?.name || '';
    }, [classById]);

    const getAssistantName = useCallback((log) => {
        return log.tutor || log.assistantName || log.assistant?.name || '';
    }, []);

    const getParentPhoneLast4 = useCallback((log) => {
        const st = resolveStudentFromLog(log);
        return getParentLast4ForStudent(st);
    }, [resolveStudentFromLog, getParentLast4ForStudent]);


    useEffect(() => {
        if (debugSampleLoggedRef.current) return;
        if (!(activeClinicLogs || []).length) return;

        const sample = (activeClinicLogs || []).slice(0, 5).map((l) => ({
            id: l?.id,
            studentId: l?.studentId,
            studentUid: l?.studentUid,
            authUid: l?.authUid,
            resolvedStudent: resolveStudentFromLog(l)?.id,
            resolvedAuthUid: resolveStudentFromLog(l)?.authUid,
            resolvedUid: resolveStudentFromLog(l)?.uid,
            last4: getParentPhoneLast4(l),
        }));
        console.log('[clinic][debug] student key mapping sample', sample);
        debugSampleLoggedRef.current = true;
    }, [activeClinicLogs, resolveStudentFromLog, getParentPhoneLast4]);

    const resetFilters = () => {
        setSelectedClassId('');
        setSelectedAssistantId('');
        setSearchText('');
        setRangeFrom('');
        setRangeTo('');
    };

    const dateLogs = useMemo(() => {
        if (filterMode !== 'date') return [];
        if (!selectedDate) return [];

        const filteredByDeletion = activeClinicLogs.filter(log => !log?.isDeleted);
        const filtered = filteredByDeletion.filter(log => {
            const d = String(log.effectiveDate || log.date || '').slice(0, 10);
            return d === selectedDate;
        });

        return [...filtered].sort((a, b) => {
            const dA = String(a.effectiveDate || a.date || '');
            const dB = String(b.effectiveDate || b.date || '');
            const dateCompare = dB.localeCompare(dA);
            if (dateCompare !== 0) return dateCompare;
            const nameCompare = String(getStudentName(a) || '').localeCompare(String(getStudentName(b) || ''), 'ko');
            if (nameCompare !== 0) return nameCompare;
            return String(a.id).localeCompare(String(b.id));
        });
    }, [filterMode, selectedDate, activeClinicLogs, getStudentName]);

    const filteredAndSortedLogs = useMemo(() => {
        const filteredByDeletion = activeClinicLogs.filter(log => !log?.isDeleted);
        const normalizedSelected = normalizeSelectedClassId(selectedClassId, classes);

        console.log('[clinic] selectedClassId raw=', selectedClassId, 'normalized=', normalizedSelected);
        console.log('[clinic] sample class keys=', activeClinicLogs.slice(0, 10).map(it => ({
            id: it.id,
            classId: it.classId,
            classDocId: it.classDocId,
            className: it.className,
            ref: it.classRef,
        })));

        const normalizedSearch = searchText.trim().toLowerCase();
        const filtered = filteredByDeletion.filter(log => {
            if (normalizedSelected) {
                const itemClassId = getItemClassId(log, classes);
                if (!itemClassId) return false;
                if (String(itemClassId) !== String(normalizedSelected)) return false;
            }
            if (selectedAssistantId) {
                const assistantId = log.assistantId || log.tutorId || log.assistant?.id || '';
                if (assistantId) {
                    if (assistantId !== selectedAssistantId) return false;
                } else if (getAssistantName(log) !== selectedAssistantId) {
                    return false;
                }
            }

            const logDate = String(log.effectiveDate || log.date || '').slice(0, 10);
            if (rangeFrom && logDate && logDate < rangeFrom) return false;
            if (rangeTo && logDate && logDate > rangeTo) return false;

            if (!normalizedSearch) return true;

            const searchPool = [
                getStudentName(log),
                getClassName(log),
                getAssistantName(log),
                log.comment,
                log.memo,
                log.note,
                log.notes,
                getParentPhoneLast4(log),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchPool.includes(normalizedSearch);
        });

        return [...filtered].sort((a, b) => {
            const dA = String(a.effectiveDate || a.date || '');
            const dB = String(b.effectiveDate || b.date || '');
            const dateCompare = dB.localeCompare(dA);
            if (dateCompare !== 0) return dateCompare;
            const nameCompare = String(getStudentName(a) || '').localeCompare(String(getStudentName(b) || ''), 'ko');
            if (nameCompare !== 0) return nameCompare;
            return String(a.id).localeCompare(String(b.id));
        });
    }, [
        activeClinicLogs,
        classes,
        selectedClassId,
        selectedAssistantId,
        searchText,
        normalizeSelectedClassId,
        getItemClassId,
        getStudentName,
        getClassName,
        getAssistantName,
        getParentPhoneLast4,
        rangeFrom,
        rangeTo,
    ]);
    const totalPages = useMemo(() => {
        if (filterMode !== 'all') return 1;
        return Math.max(1, Math.ceil(filteredAndSortedLogs.length / PAGE_SIZE));
    }, [filteredAndSortedLogs.length, filterMode]);

    useEffect(() => {
        if (filterMode !== 'all') return;
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages, filterMode]);

    const pageLogs = useMemo(() => {
        if (filterMode !== 'all') return [];
        const startIndex = (page - 1) * PAGE_SIZE;
        return filteredAndSortedLogs.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredAndSortedLogs, page, filterMode]);

    const visibleLogs = filterMode === 'date' ? dateLogs : pageLogs;


    useEffect(() => {
        let cancelled = false;

        const loadTimelineItems = async () => {
            const clinicLogIds = (visibleLogs || []).map((log) => log?.id).filter(Boolean);
            if (clinicLogIds.length === 0) {
                setClinicTimelineItems([]);
                setClinicTimelineError('');
                return;
            }

            try {
                const items = await fetchClinicTimelineThreads(db, clinicLogIds);
                if (!cancelled) {
                    setClinicTimelineItems(items);
                    setClinicTimelineError('');
                }
            } catch (error) {
                console.error('[staffTimeline] failed to load clinic timeline items', error);
                if (!cancelled) {
                    setClinicTimelineItems([]);
                    setClinicTimelineError('교직원 메모를 불러오지 못했습니다.');
                }
            }
        };

        loadTimelineItems();
        return () => { cancelled = true; };
    }, [visibleLogs]);

    const clinicTimelineItemsByLogId = useMemo(() => {
        const grouped = new Map();
        (clinicTimelineItems || []).forEach((item) => {
            const key = String(item?.sourceDocId || '');
            if (!key) return;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(item);
        });
        return grouped;
    }, [clinicTimelineItems]);

    const getTimelineCountText = useCallback((logId) => {
        const count = clinicTimelineItemsByLogId.get(String(logId || ''))?.length || 0;
        return count > 0 ? `교직원 메모 ${count}` : '교직원 메모';
    }, [clinicTimelineItemsByLogId]);

    const refreshClinicTimelineItems = useCallback(async () => {
        const clinicLogIds = (visibleLogs || []).map((log) => log?.id).filter(Boolean);
        if (clinicLogIds.length === 0) {
            setClinicTimelineItems([]);
            return;
        }
        const items = await fetchClinicTimelineThreads(db, clinicLogIds);
        setClinicTimelineItems(items);
    }, [visibleLogs]);

    const handleStaffMemoDraftChange = (logId, value) => {
        setStaffMemoDrafts((prev) => ({ ...prev, [logId]: value }));
    };

    const handleToggleStaffMemo = (logId) => {
        setOpenStaffMemoLogId((prev) => (prev === logId ? '' : logId));
    };

    const handleSaveStaffMemo = async (log) => {
        const content = String(staffMemoDrafts[log.id] || '').trim();
        if (!content) {
            alert('교직원끼리 공유할 지시사항이나 인수인계를 입력하세요.');
            return;
        }

        const resolvedStudent = resolveStudentFromLog(log);
        const studentId = String(
            resolvedStudent?.id
            || log?.studentDocId
            || log?.studentId
            || log?.studentUid
            || log?.authUid
            || '',
        );
        const studentName = getStudentName(log) || resolvedStudent?.name || '';

        setSavingStaffMemoLogId(log.id);
        try {
            await createStaffTimelineThread(db, {
                sourceType: 'clinic',
                sourceDocId: log.id,
                sourceCollection: log.sourceCollection || (log.reservationId ? 'clinicReservations' : 'clinicLogs'),
                sourceSummary: {
                    date: log.effectiveDate || log.date || log.clinicDate || '',
                    plannedTime: log.plannedTime || log.timeSlot || '',
                    teacherName: log.teacherName || log.tutorName || getAssistantName(log) || '',
                    clinicComment: log.clinicComment || log.comment || log.content || '',
                    status: log.displayStatus || log.status || (log.checkIn ? 'attended' : 'pending'),
                },
                studentId,
                studentName,
                content,
                createdBy: user?.uid || '',
                createdByName: currentUserName,
                senderRole: currentSenderRole,
            });
            setStaffMemoDrafts((prev) => ({ ...prev, [log.id]: '' }));
            setOpenStaffMemoLogId('');
            await refreshClinicTimelineItems();
        } catch (error) {
            console.error('[staffTimeline] failed to save clinic memo', error);
            alert(error?.message || '교직원 메모 저장에 실패했습니다.');
        } finally {
            setSavingStaffMemoLogId('');
        }
    };

    const renderStaffMemoPanel = (log, className = '') => {
        const threads = clinicTimelineItemsByLogId.get(String(log.id || '')) || [];
        return (
            <div className={`rounded-xl border border-[#dfe6ff] bg-[#f8f9ff] p-3 text-left ${className}`}>
                {threads.length > 0 && (
                    <div className="mb-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[#334a91]">연결된 교직원 메모</p>
                            <span className="text-[11px] font-semibold text-gray-500">{threads.length}건</span>
                        </div>
                        {threads.map((thread) => (
                            <StaffTimelineThreadCard
                                key={thread.id}
                                thread={thread}
                                actor={timelineActor}
                                onChanged={refreshClinicTimelineItems}
                                showStudentName={false}
                                compact
                            />
                        ))}
                    </div>
                )}
                <div className="rounded-lg border border-[#dfe6ff] bg-white p-3">
                    <p className="mb-2 text-xs font-bold text-gray-700">새 교직원 메모</p>
                    <textarea
                        value={staffMemoDrafts[log.id] || ''}
                        onChange={(event) => handleStaffMemoDraftChange(log.id, event.target.value)}
                        placeholder="교직원끼리 공유할 지시사항이나 인수인계를 입력하세요."
                        className="min-h-[82px] w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:border-[#334a91] focus:outline-none focus:ring-2 focus:ring-[#cfd8ff]"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={() => handleToggleStaffMemo(log.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600">닫기</button>
                        <button type="button" onClick={() => handleSaveStaffMemo(log)} disabled={savingStaffMemoLogId === log.id} className="rounded-lg bg-[#455fab] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                            {savingStaffMemoLogId === log.id ? '저장 중...' : '새 메모 저장'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    useEffect(() => {
        setSelectedLogIds([]);
    }, [filterMode, selectedDate, rangeFrom, rangeTo]);

    useEffect(() => {
        if (filterMode === 'all') {
            setPage(1);
        }
    }, [filterMode, selectedClassId, selectedAssistantId, searchText, rangeFrom, rangeTo]);

    // 핸들러
    const openScheduleModal = () => setIsScheduleModalOpen(true);
    
    const openUnscheduledLogModal = () => {
        setSelectedLog(null);
        setIsCommentModalOpen(true);
    }
    
    const openCommentModal = (log) => {
        setSelectedLog(log);
        setIsCommentModalOpen(true);
    };

    // 통합 알림 버튼 핸들러
    const handleNotifyClick = (log) => {
        const status = log.status || (log.checkIn ? 'attended' : 'pending');

        if (status === 'pending') {
            alert("⚠️ '예약됨' 상태에서는 알림을 보낼 수 없습니다.\n학생의 출석 여부(참석/미참석)를 먼저 확정해주세요.");
            return;
        }

        if (status === 'no-show') {
            openNotifyModal(log, 'no-show');
        } else {
            // attended 상태
            openNotifyModal(log, 'comment');
        }
    };

    const openNotifyModal = (log, type) => {
        // 코멘트 알림일 때만 코멘트 필수 체크
        if (type === 'comment' && !log.comment) {
            alert("작성된 코멘트가 없습니다. 먼저 코멘트를 입력해주세요.");
            return;
        }
        setSelectedLog(log);
        setSelectedNotificationType(type);
        setIsNotifyModalOpen(true);
    };

    const handleNotificationSent = (logId, scheduleTime) => {
        const log = activeClinicLogs.find(l => l.id === logId);
        if (log) {
            handleSaveClinicLog({ 
                ...log, 
                notificationSent: true, 
                notificationScheduledTime: scheduleTime || null 
            }, true);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedLogIds(visibleLogs.map(log => log.id));
        } else {
            setSelectedLogIds([]);
        }
    };

    const handleSelectLog = (id) => {
        setSelectedLogIds(prev => 
            prev.includes(id) ? prev.filter(logId => logId !== id) : [...prev, id]
        );
    };

    const openBulkNotifyModal = () => {
        if (selectedLogIds.length === 0) return;
        setIsBulkNotifyModalOpen(true);
    };

    const renderStatusBadge = (log) => {
        const status = log.status || (log.checkIn ? 'attended' : 'pending');
        switch(status) {
            case 'attended':
                // [색상 변경] 참석: bg-blue-100 -> bg-[#eef2ff], text-[#334a91] -> text-[#334a91]
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#eef2ff] text-[#334a91]">참석 완료</span>;
            case 'no-show':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">미참석</span>;
            case 'pending':
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">예약됨</span>;
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[80vh] flex flex-col">
                
                {/* 모드 전환 탭 */}
                <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg w-full sm:w-fit mb-6">
                    <button
                        onClick={() => setViewMode('staff')}
                        // [색상 변경] text-[#455fab] -> text-[#334a91]
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${viewMode === 'staff' ? 'bg-white text-[#334a91] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Icon name="briefcase" className="w-4 h-4 mr-2 inline-block"/>
                        관리자/직원 모드 (예약/발송)
                    </button>
                    <button
                        onClick={() => setViewMode('tutor')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${viewMode === 'tutor' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Icon name="edit" className="w-4 h-4 mr-2 inline-block"/>
                        조교 모드 (기록/코멘트)
                    </button>
                </div>

                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div className='flex items-center space-x-4'>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilterMode('all')}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${filterMode === 'all' ? 'bg-[#455fab] text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-800'}`}
                            >
                                전체
                            </button>
                            <button
                                onClick={() => setFilterMode('date')}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${filterMode === 'date' ? 'bg-[#455fab] text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-800'}`}
                            >
                                날짜별
                            </button>
                            {filterMode === 'date' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#334a91] focus:border-[#334a91] text-sm font-medium text-gray-700"
                                    />
                                </div>
                            )}
                        </div>
                        <span className="text-gray-500 text-sm font-medium">
                            {filterMode === 'all' ? filteredAndSortedLogs.length : dateLogs.length}건의 일정
                        </span>
                    </div>
                    <div className='flex flex-wrap gap-2 justify-start md:justify-end'>
                        {/* 조교 모드 버튼 */}
                        {viewMode === 'tutor' && (
                            <button 
                                onClick={openUnscheduledLogModal}
                                className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center shadow transition"
                            >
                                미예약 학생 기록
                            </button>
                        )}
                        {/* 관리자 모드 버튼: [색상 변경] bg-[#455fab] -> bg-[#455fab] */}
                        {viewMode === 'staff' && (
                            <button onClick={openScheduleModal} className="bg-[#455fab] hover:bg-[#3b5198] text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center shadow transition">
                                <Icon name="calendar" className="w-4 h-4 mr-2" /> 클리닉 예약
                            </button>
                        )}
                    </div>
                </div>

                {filterMode === 'all' && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                <label className="text-xs font-semibold text-gray-600">
                                    클래스
                                    <select
                                        value={selectedClassId}
                                        onChange={(e) => setSelectedClassId(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#334a91] focus:outline-none focus:ring-2 focus:ring-[#cfd8ff]"
                                    >
                                        <option value="">전체</option>
                                        {classOptions.map(option => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-xs font-semibold text-gray-600">
                                    담당 조교
                                    <select
                                        value={selectedAssistantId}
                                        onChange={(e) => setSelectedAssistantId(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#334a91] focus:outline-none focus:ring-2 focus:ring-[#cfd8ff]"
                                    >
                                        <option value="">전체</option>
                                        {assistantOptions.map(option => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-xs font-semibold text-gray-600">
                                    검색
                                    <input
                                        type="text"
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        placeholder="학생/클래스/담당자/메모 검색"
                                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#334a91] focus:outline-none focus:ring-2 focus:ring-[#cfd8ff]"
                                    />
                                </label>
                                <label className="text-xs font-semibold text-gray-600">
                                    기간(From)
                                    <input
                                        type="date"
                                        value={rangeFrom}
                                        onChange={(e) => setRangeFrom(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#334a91] focus:outline-none focus:ring-2 focus:ring-[#cfd8ff]"
                                    />
                                </label>
                                <label className="text-xs font-semibold text-gray-600">
                                    기간(To)
                                    <input
                                        type="date"
                                        value={rangeTo}
                                        onChange={(e) => setRangeTo(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#334a91] focus:outline-none focus:ring-2 focus:ring-[#cfd8ff]"
                                    />
                                </label>
                            </div>
                            <button
                                onClick={resetFilters}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-[#cfd8ff] hover:text-[#334a91] lg:w-auto"
                            >
                                필터 초기화
                            </button>
                        </div>
                    </div>
                )}

                {viewMode === 'staff' && selectedLogIds.length > 0 && (
                    <div className="bg-[#f1f4ff] border border-[#eef2ff] p-3 rounded-lg mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 animate-fade-in">
                        <span className="text-sm font-bold text-[#334a91] ml-2">{selectedLogIds.length}명 선택됨</span>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => { if(window.confirm(`선택한 ${selectedLogIds.length}건의 일정을 정말 삭제하시겠습니까?`)) { selectedLogIds.forEach(id => handleDeleteClinicLog(id)); setSelectedLogIds([]); } }} className="bg-white border border-gray-300 text-red-600 hover:bg-red-50 text-xs font-bold py-1.5 px-3 rounded-md flex items-center transition">
                                <Icon name="trash" className="w-3 h-3 mr-1" /> 선택 삭제
                            </button>
                            <button onClick={openBulkNotifyModal} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded-md flex items-center shadow-sm transition">
                                <Icon name="send" className="w-3 h-3 mr-1" /> 선택 알림 일괄 발송/예약
                            </button>
                        </div>
                    </div>
                )}

                {clinicTimelineError && (
                    <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        {clinicTimelineError}
                    </div>
                )}

                <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    {viewMode === 'staff' && (
                                        <th className="px-4 py-3 text-center w-10">
                                            <input type="checkbox" onChange={handleSelectAll} checked={visibleLogs.length > 0 && selectedLogIds.length === visibleLogs.length} className="rounded text-[#334a91] focus:ring-[#334a91] h-4 w-4" />
                                        </th>
                                    )}
                                    {filterMode === 'all' && (
                                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider min-w-[90px]">날짜</th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">학생명</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">예정</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">상태</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">실제 시간</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-2/5">코멘트</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">담당 조교</th>
                                    {viewMode === 'staff' && <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">알림 상태</th>}
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">관리</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {visibleLogs.length > 0 ? (
                                    visibleLogs.map(log => {
                                        const isUnscheduled = !log.plannedTime;
                                        const isSent = log.notificationSent;
                                        const isSelected = selectedLogIds.includes(log.id);
                                        const status = log.status || (log.checkIn ? 'attended' : 'pending');
                                        
                                        return (
                                            // [색상 변경] hover:bg-gray-50 -> hover:bg-[#f1f4ff]/30
                                            <tr key={log.id} className={`hover:bg-[#f1f4ff]/30 transition ${isSelected ? 'bg-[#f1f4ff]' : ''}`}>
                                                {viewMode === 'staff' && (
                                                    <td className="px-4 py-4 text-center">
                                                        <input type="checkbox" checked={isSelected} onChange={() => handleSelectLog(log.id)} className="rounded text-[#334a91] focus:ring-[#334a91] h-4 w-4" />
                                                    </td>
                                                )}
                                                {filterMode === 'all' && (
                                                    <td className="px-3 py-4 whitespace-nowrap text-xs font-mono text-gray-600">
                                                        {log.effectiveDate || log.date || ''}
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {(() => {
                                                        const resolved = resolveStudentFromLog(log);
                                                        const fallback = { id: String(log?.studentDocId || log?.studentId || log?.studentUid || log?.authUid || ''), name: getStudentName(log) };
                                                        return (
                                                            <StudentNameWithParentLast4
                                                                student={resolved || fallback}
                                                                parentLast4Map={parentLast4Map}
                                                                className="text-sm font-bold text-gray-900"
                                                            />
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    {isUnscheduled ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">미예약</span> : <span className="text-sm font-medium text-gray-700 font-mono">{log.plannedTime}</span>}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">{renderStatusBadge(log)}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                                                    {log.checkIn ? <span className="font-mono font-bold text-[#334a91] bg-[#f1f4ff] px-2 py-1 rounded">{log.checkIn} ~ {log.checkOut || '...'}</span> : <span className="text-gray-300">-</span>}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-700">
                                                    {log.comment ? <div className="line-clamp-2 text-gray-800" title={log.comment}>{log.comment}</div> : <span className="text-gray-400 text-xs italic">내용 없음</span>}
                                                </td>
                                                <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-gray-600">{log.tutor || '-'}</td>

                                                {viewMode === 'staff' && (
                                                    <td className="px-4 py-4 whitespace-nowrap text-center">
                                                        {isSent ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><Icon name="check" className="w-3 h-3 mr-1" /> 발송됨</span> : 
                                                         (log.comment || status === 'no-show') ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><Icon name="clock" className="w-3 h-3 mr-1" /> 대기</span> : 
                                                         <span className="text-gray-400 text-xs">-</span>}
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 text-center text-sm font-medium">
                                                    <div className="flex flex-col items-center gap-2">
                                                    <div className="flex justify-center space-x-1">
                                                        <button onClick={() => openCommentModal(log)} className="text-gray-500 hover:text-[#334a91] p-1.5 rounded hover:bg-gray-100 transition" title="기록 수정"><Icon name="edit" className="w-4 h-4" /></button>
                                                        
                                                        {viewMode === 'staff' && (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleNotifyClick(log)}
                                                                    className={`p-1.5 rounded hover:bg-gray-100 transition ${isSent ? 'text-green-600' : 'text-gray-400 hover:text-[#334a91]'}`}
                                                                    title="알림 발송"
                                                                >
                                                                    <Icon name="bell" className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                        type="button"
                                                                        onClick={() => handleToggleStaffMemo(log.id)}
                                                                        className="rounded border border-[#dfe6ff] bg-[#f1f4ff] px-2 py-1 text-[11px] font-bold text-[#334a91] transition hover:bg-[#e7ecff]"
                                                                        title="교직원 메모"
                                                                    >
                                                                        {getTimelineCountText(log.id)}
                                                                    </button>

                                                                <button onClick={() => {if(window.confirm('일정을 삭제하시겠습니까?')) handleDeleteClinicLog(log.id)}} className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-gray-100 transition" title="삭제"><Icon name="trash" className="w-4 h-4" /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                    {viewMode === 'staff' && openStaffMemoLogId === log.id && renderStaffMemoPanel(log, 'w-[32rem] max-w-[80vw]')}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={viewMode === 'staff' ? (filterMode === 'all' ? 10 : 9) : (filterMode === 'all' ? 8 : 7)} className="px-6 py-12 text-center text-gray-500 bg-gray-50">
                                            <div className="flex flex-col items-center">
                                                <Icon name="calendar" className="w-12 h-12 text-gray-300 mb-2" />
                                                <p className="text-lg font-medium">등록된 일정이 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filterMode === 'all' && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                            <span className="font-medium">총 {filteredAndSortedLogs.length}개</span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                    disabled={page <= 1}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-[#cfd8ff] hover:text-[#334a91] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    이전
                                </button>
                                <span className="text-xs font-semibold text-gray-600">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={page >= totalPages}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-[#cfd8ff] hover:text-[#334a91] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    다음
                                </button>
                            </div>
                        </div>
                    )}


                    {hasMore && (
                        <div className="p-4 text-center">
                            <button
                                onClick={handleLoadMore}
                                className="bg-[#455fab] text-white px-4 py-2 rounded-lg"
                            >
                                더 보기
                            </button>
                        </div>
                    )}
                    <div className="md:hidden p-3 space-y-3 overflow-y-auto">
                        {visibleLogs.length > 0 ? visibleLogs.map(log => {
                            const isUnscheduled = !log.plannedTime;
                            const isSent = log.notificationSent;
                            const isSelected = selectedLogIds.includes(log.id);
                            const dateText = log.effectiveDate || log.date || '';

                            return (
                                <div key={log.id} className={`bg-white border rounded-xl shadow-sm p-4 space-y-3 ${isSelected ? 'ring-1 ring-[#cfd8ff]' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            {(() => {
                                                const resolved = resolveStudentFromLog(log);
                                                const fallback = { id: String(log?.studentDocId || log?.studentId || log?.studentUid || log?.authUid || ''), name: getStudentName(log) };
                                                return (
                                                    <StudentNameWithParentLast4
                                                        student={resolved || fallback}
                                                        parentLast4Map={parentLast4Map}
                                                        className="text-base font-bold text-gray-900"
                                                        suffixClassName="text-xs font-normal text-gray-400 ml-1"
                                                    />
                                                );
                                            })()}
                                            {filterMode === 'all' && dateText && (
                                                <p className="mt-0.5 text-xs font-mono text-gray-500">{dateText}</p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-0.5">{log.tutor || '담당 조교 미정'}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {viewMode === 'staff' && (
                                                <label className="flex items-center gap-1 text-xs text-gray-600">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => handleSelectLog(log.id)} 
                                                        className="rounded text-[#334a91] focus:ring-[#334a91] h-4 w-4"
                                                    />
                                                    선택
                                                </label>
                                            )}
                                            {renderStatusBadge(log)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                                            <p className="font-semibold text-gray-700">예정</p>
                                            <p className="mt-0.5">{isUnscheduled ? '미예약' : log.plannedTime}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                                            <p className="font-semibold text-gray-700">실제 시간</p>
                                            <p className="mt-0.5 font-mono text-[11px]">
                                                {log.checkIn ? `${log.checkIn} ~ ${log.checkOut || '...'}` : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-sm text-gray-700">
                                        {log.comment ? (
                                            <p className="leading-snug">{log.comment}</p>
                                        ) : (
                                            <p className="text-gray-400 text-xs italic">코멘트가 없습니다.</p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button 
                                            onClick={() => openCommentModal(log)} 
                                            className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-[#f1f4ff] hover:text-[#334a91] transition"
                                        >
                                            기록/코멘트
                                        </button>
                                        
                                        {viewMode === 'staff' && (
                                            <>
                                                <button 
                                                    onClick={() => handleNotifyClick(log)}
                                                    className={`flex-1 text-sm font-semibold px-3 py-2 rounded-lg border transition ${
                                                        isSent ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:border-[#cfd8ff]'
                                                    }`}
                                                >
                                                    알림 {isSent ? '완료' : '발송'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStaffMemo(log.id)}
                                                    className="flex-1 rounded-lg border border-[#dfe6ff] bg-[#f1f4ff] px-3 py-2 text-sm font-semibold text-[#334a91] transition hover:bg-[#e7ecff]"
                                                >
                                                    {getTimelineCountText(log.id)}
                                                </button>
                                                <button 
                                                    onClick={() => {if(window.confirm('일정을 삭제하시겠습니까?')) handleDeleteClinicLog(log.id)}}
                                                    className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition"
                                                >
                                                    삭제
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {viewMode === 'staff' && openStaffMemoLogId === log.id && renderStaffMemoPanel(log)}
                                </div>
                            );
                        }) : (
                            <div className="text-center text-gray-500 text-sm py-8">
                                {filterMode === 'date' ? '선택한 날짜에 일정이 없습니다.' : '등록된 일정이 없습니다.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ClinicScheduleModal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} onSave={handleSaveClinicLog} students={students} parents={parents} defaultDate={selectedDate || new Date().toISOString().slice(0, 10)} clinicLogs={activeClinicLogs} classes={classes} />
            <ClinicCommentModal isOpen={isCommentModalOpen} onClose={() => setIsCommentModalOpen(false)} onSave={handleSaveClinicLog} log={selectedLog} students={students} parents={parents} clinicLogs={activeClinicLogs} defaultDate={selectedDate || new Date().toISOString().slice(0, 10)} classes={classes} studentOptions={studentOptions} />
            <ClinicNotificationModal isOpen={isNotifyModalOpen} onClose={() => setIsNotifyModalOpen(false)} log={selectedLog} students={students} logNotification={logNotification} onSent={handleNotificationSent} notificationType={selectedNotificationType} />
            <ClinicBulkNotificationModal isOpen={isBulkNotifyModalOpen} onClose={() => setIsBulkNotifyModalOpen(false)} selectedLogs={visibleLogs.filter(log => selectedLogIds.includes(log.id))} students={students} logNotification={logNotification} onSent={handleNotificationSent} />
        </div>
    );
};