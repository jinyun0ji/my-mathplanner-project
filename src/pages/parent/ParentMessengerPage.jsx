import React, { useEffect, useMemo, useState } from 'react';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import StudentMessenger from '../../components/StudentMessenger';
import { auth, db } from '../../firebase/client';

const INSTITUTE_SLOT = 'institute';
const TEACHER_SLOT = 'teacher';
const INSTITUTE_NAME = '채수용 수학 연구소';
const INSTITUTE_AUTH_UID = 'lVwBt6If6JVwkop9uPIbOIHQmwg2';
const TEACHER_AUTH_UID = 'EzOXjwwyATO2sP5yuc3CkS3oRw22';
const TEACHER_DISPLAY_NAME = '채수용 선생님';

const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();

const uniqueStrings = (values) => Array.from(new Set(
    values.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
));

const getRoomSortTime = (room) => (
    toDate(room?.lastMessageAt)?.getTime()
    || toDate(room?.updatedAt)?.getTime()
    || toDate(room?.createdAt)?.getTime()
    || 0
);

const getLastMessagePreview = (room) => (
    room?.lastMessageText
    || room?.lastMessage
    || room?.message
    || '대화 내역이 없습니다.'
);

const sortRooms = (roomList) => roomList.sort((a, b) => getRoomSortTime(b) - getRoomSortTime(a));

const getRoomTextFields = (room) => uniqueStrings([
    room?.type,
    room?.channel,
    room?.staffName,
    room?.name,
    room?.title,
    room?.displayName,
    room?.counterpartName,
    room?.teacherName,
    room?.participantName,
    room?.participantNames && Object.values(room.participantNames),
]);

const getRoomIdFields = (room) => uniqueStrings([
    room?.staffId,
    room?.staffUid,
    room?.staffAuthUid,
    room?.teacherId,
    room?.teacherUid,
    room?.teacherAuthUid,
    room?.createdBy,
    room?.updatedBy,
    room?.participantIds,
    room?.participantUserDocIds && Object.values(room.participantUserDocIds),
]);

const hasAnyKeyword = (values, keywords) => values.some((value) => {
    const lower = normalizeLower(value);
    return keywords.some((keyword) => lower.includes(keyword));
});

const roomDisplayName = (slot, teacherName = '') => {
    if (slot === INSTITUTE_SLOT) return INSTITUTE_NAME;
    const normalizedTeacherName = normalizeText(teacherName);
    if (normalizedTeacherName) return normalizedTeacherName.endsWith('선생님') ? normalizedTeacherName : `${normalizedTeacherName} 선생님`;
    return TEACHER_DISPLAY_NAME;
};

const getTeacherCandidates = (classes = []) => {
    const candidates = [{ name: TEACHER_DISPLAY_NAME, ids: [TEACHER_AUTH_UID] }];
    classes.forEach((classInfo) => {
        const name = normalizeText(
            classInfo?.teacherName
            || classInfo?.teacher
            || classInfo?.instructorName
            || classInfo?.instructor
            || classInfo?.tutorName
            || classInfo?.tutor
        );
        const ids = uniqueStrings([
            classInfo?.teacherAuthUid,
            classInfo?.teacherUid,
            classInfo?.teacherId,
            classInfo?.teacherUserDocId,
            classInfo?.instructorAuthUid,
            classInfo?.instructorUid,
            classInfo?.instructorId,
            classInfo?.staffAuthUid,
            classInfo?.staffUid,
            classInfo?.staffId,
        ]);
        if (!name && ids.length === 0) return;
        candidates.push({ name, ids });
    });

    return candidates.filter((candidate, index, list) => (
        list.findIndex((item) => item.name === candidate.name && item.ids.join('|') === candidate.ids.join('|')) === index
    ));
};

const getTeacherNameForDisplay = (teacherCandidates, teacherRoom = null) => {
    const roomName = normalizeText(
        teacherRoom?.teacherName
        || teacherRoom?.staffName
        || teacherRoom?.counterpartName
        || teacherRoom?.name
        || teacherRoom?.title
        || teacherRoom?.displayName
    );
    if (roomName && !roomName.includes('연구소') && !roomName.includes('채수용 수학')) return roomName;
    return normalizeText(teacherCandidates.find((candidate) => candidate.name)?.name || '');
};

const isTeacherRoom = (room, teacherCandidates) => {
    if (!room) return false;
    const participantIds = getRoomIdFields(room);
    if (participantIds.includes(TEACHER_AUTH_UID)) return true;
    if (teacherCandidates.length === 0) return false;
    const roomTexts = getRoomTextFields(room);
    const roomIds = new Set(participantIds);

    return teacherCandidates.some((candidate) => {
        const idsMatch = candidate.ids.some((id) => roomIds.has(id));
        const nameMatch = candidate.name && roomTexts.some((text) => normalizeText(text).includes(candidate.name));
        return idsMatch || nameMatch;
    });
};

const isExplicitInstituteRoom = (room) => {
    const roomTexts = getRoomTextFields(room);
    return hasAnyKeyword(roomTexts, ['연구소', '채수용', 'institute', 'academy', 'lab', 'center', '운영', '관리자']);
};

const isStaffDirectRoom = (room) => {
    const type = normalizeLower(room?.type);
    const channel = normalizeLower(room?.channel);
    const participantRoles = room?.participantRoles && typeof room.participantRoles === 'object'
        ? Object.values(room.participantRoles).map(normalizeLower)
        : [];
    return type.includes('direct')
        || type.includes('individual')
        || channel.includes('direct')
        || Boolean(room?.staffId || room?.staffUid || room?.staffAuthUid)
        || participantRoles.some((role) => ['admin', 'staff', 'operator', 'teacher', 'teaching'].includes(role));
};

const buildMessengerSlots = (rooms, teacherCandidates) => {
    const sortedRooms = sortRooms([...rooms]);
    const teacherCandidatesRooms = sortedRooms.filter((room) => isTeacherRoom(room, teacherCandidates));
    const teacherRoom = teacherCandidatesRooms.find((room) => getRoomIdFields(room).includes(TEACHER_AUTH_UID)) || teacherCandidatesRooms[0] || null;

    const nonTeacherRooms = sortedRooms.filter((room) => room.id !== teacherRoom?.id && !isTeacherRoom(room, teacherCandidates));
    const explicitInstituteRoom = nonTeacherRooms.find((room) => getRoomIdFields(room).includes(INSTITUTE_AUTH_UID)) || nonTeacherRooms.find((room) => isExplicitInstituteRoom(room));
    const fallbackInstituteRoom = nonTeacherRooms.find((room) => isStaffDirectRoom(room));
    const instituteRoom = explicitInstituteRoom || fallbackInstituteRoom || null;

    const teacherName = getTeacherNameForDisplay(teacherCandidates, teacherRoom);

    return [
        {
            slot: INSTITUTE_SLOT,
            room: instituteRoom,
            id: instituteRoom?.id || `${INSTITUTE_SLOT}-placeholder`,
            title: roomDisplayName(INSTITUTE_SLOT),
        },
        {
            slot: TEACHER_SLOT,
            room: teacherRoom,
            id: teacherRoom?.id || `${TEACHER_SLOT}-placeholder`,
            title: roomDisplayName(TEACHER_SLOT, teacherName),
            teacherName: teacherName || TEACHER_DISPLAY_NAME,
        },
    ];
};

const buildRoomQueries = ({ authUid, parentDocId, studentId, student }) => {
    const parentDocCandidates = uniqueStrings([
        parentDocId,
        student?.parentId,
        student?.parentDocId,
    ]);
    const parentUidCandidates = uniqueStrings([
        authUid,
        student?.parentUid,
    ]);

    const descriptors = [];
    const addDescriptor = (field, op, value) => {
        if (!value) return;
        const queryShape = { collection: 'chatRooms', where: [field, op, value] };
        const key = JSON.stringify(queryShape);
        if (descriptors.some((item) => item.key === key)) return;
        descriptors.push({
            key,
            queryShape,
            ref: query(collection(db, 'chatRooms'), where(field, op, value)),
        });
    };

    addDescriptor('participantIds', 'array-contains', authUid);
    parentDocCandidates.forEach((candidate) => addDescriptor('participantIds', 'array-contains', candidate));
    parentUidCandidates.forEach((candidate) => addDescriptor('participantIds', 'array-contains', candidate));
    parentDocCandidates.forEach((candidate) => addDescriptor('parentId', '==', candidate));
    parentUidCandidates.forEach((candidate) => addDescriptor('parentUid', '==', candidate));
    if (studentId) {
        addDescriptor('studentId', '==', String(studentId));
        addDescriptor('studentIds', 'array-contains', String(studentId));
    }

    return descriptors;
};

export default function ParentMessengerPage({ studentId, student, ongoingClasses = [], onBack, viewerRole = 'parent' }) {
    const [rooms, setRooms] = useState([]);
    const [error, setError] = useState('');
    const [selectedSlot, setSelectedSlot] = useState(null);

    const authUid = String(auth.currentUser?.uid || '');
    const studentQueryFields = useMemo(() => ({
        parentId: student?.parentId || '',
        parentDocId: student?.parentDocId || '',
        parentUid: student?.parentUid || '',
        id: student?.id || student?.studentId || '',
    }), [student?.id, student?.studentId, student?.parentId, student?.parentDocId, student?.parentUid]);

    const teacherCandidates = useMemo(() => getTeacherCandidates(ongoingClasses), [ongoingClasses]);
    const messengerSlots = useMemo(() => buildMessengerSlots(rooms, teacherCandidates), [rooms, teacherCandidates]);
    const currentSlot = selectedSlot ? messengerSlots.find((slot) => slot.slot === selectedSlot.slot) || selectedSlot : null;
    const selectedRoomId = currentSlot?.room?.id || '';
    const currentSlotTargetAuthUid = currentSlot?.slot === TEACHER_SLOT ? TEACHER_AUTH_UID : INSTITUTE_AUTH_UID;
    const currentRoomDisplayName = currentSlot?.title || '';

    useEffect(() => {
        if (!authUid) return undefined;

        let isMounted = true;
        const unsubscribers = [];
        const roomMap = new Map();
        const failedQueries = new Set();
        let totalQueries = 0;

        const applyRooms = () => {
            if (!isMounted) return;
            setRooms(sortRooms(Array.from(roomMap.values())));
            if (failedQueries.size < totalQueries) setError('');
        };

        const logQueryFailure = ({ parentDocId, descriptor, snapshotError }) => {
            console.error('[parent messenger] failed to load chatRooms', {
                authUid,
                parentDocId,
                queryShape: descriptor.queryShape,
                code: snapshotError?.code,
                message: snapshotError?.message,
            });
        };

        const startSubscriptions = async () => {
            let parentDocId = authUid;
            try {
                const indexSnap = await getDoc(doc(db, 'userAuthIndex', authUid));
                parentDocId = indexSnap.exists() ? String(indexSnap.data()?.userDocId || authUid) : authUid;
            } catch (indexError) {
                console.error('[parent messenger] failed to load userAuthIndex', {
                    authUid,
                    parentDocId,
                    queryShape: { doc: ['userAuthIndex', authUid] },
                    code: indexError?.code,
                    message: indexError?.message,
                });
            }

            if (!isMounted) return;
            console.log('[parent messenger] participant keys', { authUid, parentDocId });

            const activeChildId = String(studentId || studentQueryFields.id || '');
            const descriptors = buildRoomQueries({ authUid, parentDocId, studentId: activeChildId, student: studentQueryFields });
            totalQueries = descriptors.length;
            if (!totalQueries) return;

            descriptors.forEach((descriptor) => {
                console.log('[parent messenger] query', {
                    authUid,
                    parentDocId,
                    queryShape: descriptor.queryShape,
                });
                const unsubscribe = onSnapshot(descriptor.ref, (snap) => {
                    failedQueries.delete(descriptor.key);
                    console.log('[parent messenger] query success', {
                        authUid,
                        parentDocId,
                        queryShape: descriptor.queryShape,
                        count: snap.size,
                    });
                    snap.docs.forEach((docSnap) => roomMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
                    applyRooms();
                }, (snapshotError) => {
                    failedQueries.add(descriptor.key);
                    logQueryFailure({ parentDocId, descriptor, snapshotError });
                    if (failedQueries.size >= totalQueries && roomMap.size === 0 && isMounted) {
                        setError('대화 목록을 불러오지 못했습니다.');
                    }
                });
                unsubscribers.push(unsubscribe);
            });
        };

        startSubscriptions();

        return () => {
            isMounted = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
        };
    }, [authUid, studentId, studentQueryFields]);

    if (currentSlot) {
        return (
            <div className="h-screen min-h-screen bg-gray-50 flex flex-col overflow-hidden">
                <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
                    <button type="button" onClick={() => setSelectedSlot(null)} className="text-gray-700">
                        <ArrowBackIosNewIcon style={{ fontSize: 18 }} />
                    </button>
                    <h1 className="text-base font-semibold text-gray-900 truncate">{currentRoomDisplayName}</h1>
                </header>
                <div className="flex-1 min-h-0">
                    <StudentMessenger
                        studentId={studentId}
                        studentAuthUid={student?.authUid || student?.studentUid || student?.uid || ''}
                        selectedRoomId={selectedRoomId}
                        teacherName={currentRoomDisplayName}
                        userRole={viewerRole}
                        allowLegacyResolve={false}
                        emptyMessage="아직 대화 내역이 없습니다."
                        chatSlot={currentSlot?.slot || ''}
                        roomCreationContext={{
                            slot: currentSlot?.slot || '',
                            targetAuthUid: currentSlotTargetAuthUid,
                            targetName: currentSlot?.slot === TEACHER_SLOT ? TEACHER_DISPLAY_NAME : INSTITUTE_NAME,
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen min-h-screen bg-gray-50 overflow-y-auto">
            <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3 sticky top-0">
                <button type="button" onClick={onBack} className="text-gray-700">
                    <ArrowBackIosNewIcon style={{ fontSize: 18 }} />
                </button>
                <h1 className="text-base font-semibold text-gray-900">메신저</h1>
            </header>
            <section className="py-2">
                {error && <div className="mx-4 mb-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2">{error}</div>}
                {messengerSlots.map((slot) => (
                    <button key={slot.id} type="button" onClick={() => setSelectedSlot(slot)} className="h-16 w-full px-4 bg-white border-b border-gray-100 flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{slot.title}</p>
                            <p className="text-xs text-gray-500 truncate">{String(getLastMessagePreview(slot.room))}</p>
                        </div>
                        <div className="text-[11px] text-gray-400">
                            {toDate(slot.room?.lastMessageAt || slot.room?.updatedAt || slot.room?.createdAt)?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || ''}
                        </div>
                    </button>
                ))}
            </section>
        </div>
    );
}