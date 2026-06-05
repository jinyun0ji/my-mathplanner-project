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

const STANDARD_ROOM_TYPES = {
    student: {
        [INSTITUTE_SLOT]: 'student_institute',
        [TEACHER_SLOT]: 'student_teacher',
    },
    parent: {
        [INSTITUTE_SLOT]: 'parent_institute',
        [TEACHER_SLOT]: 'parent_teacher',
    },
};

const getExpectedRoomType = (viewerRole, slot) => STANDARD_ROOM_TYPES[String(viewerRole || 'parent')]?.[slot] || '';
const getRoomType = (room) => normalizeText(room?.roomType || room?.channel);
const hasRoomTypeOrChannel = (room, expectedRoomType) => (
    normalizeText(room?.roomType) === expectedRoomType
    || normalizeText(room?.channel) === expectedRoomType
);
const getParticipantIds = (room) => (Array.isArray(room?.participantIds) ? room.participantIds.map(String) : []);
const getVisibleToRoles = (room) => (Array.isArray(room?.visibleToRoles) ? room.visibleToRoles.map(String) : []);
const getParticipantRole = (room, uid) => String(room?.participantRoles?.[String(uid || '')] || '').trim();
const getRoomSlot = (room) => {
    const explicitSlot = normalizeText(room?.slot);
    if (explicitSlot) return explicitSlot;
    const roomType = getRoomType(room);
    if (roomType === 'institute' || roomType.endsWith('_institute')) return INSTITUTE_SLOT;
    if (roomType === 'teacher' || roomType.endsWith('_teacher')) return TEACHER_SLOT;
    return '';
};
const isCompatibleRoomType = (room, expectedRoomType) => {
    const actualType = getRoomType(room);
    if (expectedRoomType === 'parent_institute') {
        return hasRoomTypeOrChannel(room, 'parent_institute') || getRoomSlot(room) === INSTITUTE_SLOT || !actualType;
    }
    if (actualType === expectedRoomType) return true;
    if (actualType === 'institute') return expectedRoomType === 'student_institute';
    if (actualType === 'teacher') return expectedRoomType.endsWith('_teacher');
    return false;
};

const hasExpectedParticipants = (room, authUid, targetAuthUid) => {
    const participantIds = getParticipantIds(room);
    return participantIds.length === 2
        && participantIds.includes(String(authUid || ''))
        && participantIds.includes(String(targetAuthUid || ''));
};

const isStudentIdCompatible = (room, studentId) => {
    const roomStudentId = normalizeText(room?.studentId);
    return !roomStudentId || !studentId || roomStudentId === String(studentId || '');
};

const isParentInstituteBaseCandidate = (room, { authUid, targetAuthUid, studentId }) => {
    if (!hasExpectedParticipants(room, authUid, targetAuthUid)) return false;
    if (!isStudentIdCompatible(room, studentId)) return false;
    if (hasRoomTypeOrChannel(room, 'student_institute')) return false;
    if (getParticipantRole(room, authUid) === 'student') return false;
    if (room?.counterpartUid && String(room.counterpartUid) !== String(targetAuthUid || '')) return false;
    if (room?.staffAuthUid && String(room.staffAuthUid) !== String(targetAuthUid || '')) return false;
    return true;
};

const isParentInstituteLegacyRoom = (room, options) => (
    isParentInstituteBaseCandidate(room, options)
    && (getVisibleToRoles(room).includes('parent') || getParticipantRole(room, options.authUid) === 'parent')
);

const getParentInstitutePriority = (room, options) => {
    if (!isParentInstituteBaseCandidate(room, options)) return 0;
    if (hasRoomTypeOrChannel(room, 'parent_institute')) return 3;
    if (getRoomSlot(room) === INSTITUTE_SLOT) return 2;
    if (isParentInstituteLegacyRoom(room, options)) return 1;
    return 0;
};

const isStandardSlotRoom = (room, { viewerRole, slot, authUid, targetAuthUid, studentId, teacherName = '' }) => {
    const expectedRoomType = getExpectedRoomType(viewerRole, slot);
    if (!room || !expectedRoomType || !isCompatibleRoomType(room, expectedRoomType)) return false;
    const roomSlot = getRoomSlot(room);
    if (roomSlot && roomSlot !== slot) return false;
    const participantIds = getParticipantIds(room);
    if (expectedRoomType === 'parent_institute') {
        return getParentInstitutePriority(room, { authUid, targetAuthUid, studentId }) > 0;
    }
    if (participantIds.length !== 2) return false;
    if (!participantIds.includes(String(authUid || '')) || !participantIds.includes(String(targetAuthUid || ''))) return false;
    if (expectedRoomType !== 'parent_institute' && room?.counterpartUid && String(room.counterpartUid) !== String(targetAuthUid || '')) return false;
    if (slot === TEACHER_SLOT) {
        const roomTeacherName = normalizeText(room?.teacherName || room?.counterpartName);
        const expectedTeacherName = normalizeText(teacherName);
        if (room?.targetRole && String(room.targetRole) !== 'teacher') return false;
        if (room?.teacherAuthUid && String(room.teacherAuthUid) !== String(targetAuthUid || '')) return false;
        if (!room?.teacherAuthUid && !room?.counterpartUid && expectedTeacherName && roomTeacherName && roomTeacherName !== expectedTeacherName) return false;
    }
    if (expectedRoomType === 'parent_teacher' && studentId && room?.studentId && String(room.studentId) !== String(studentId)) return false;
    return true;
};

const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value) => String(value || '').trim();

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

const buildMessengerSlots = (rooms, teacherCandidates, { viewerRole = 'parent', authUid = '', studentId = '' } = {}) => {
    const sortedRooms = sortRooms([...rooms]);
    const teacherRoom = sortedRooms.find((room) => isStandardSlotRoom(room, {
        viewerRole,
        slot: TEACHER_SLOT,
        authUid,
        targetAuthUid: TEACHER_AUTH_UID,
        studentId,
        teacherName: TEACHER_DISPLAY_NAME,
    })) || null;

    const instituteCandidates = sortedRooms
        .map((room) => ({
            room,
            priority: getParentInstitutePriority(room, {
                authUid,
                targetAuthUid: INSTITUTE_AUTH_UID,
                studentId,
            }),
        }))
        .filter((candidate) => candidate.priority > 0);
    const instituteRoom = instituteCandidates
        .sort((left, right) => right.priority - left.priority || getRoomSortTime(right.room) - getRoomSortTime(left.room))
        .map((candidate) => candidate.room)[0] || null;

    const teacherName = getTeacherNameForDisplay(teacherCandidates, teacherRoom);

    return [
        {
            slot: INSTITUTE_SLOT,
            room: instituteRoom,
            id: instituteRoom?.id || `${INSTITUTE_SLOT}-placeholder`,
            title: roomDisplayName(INSTITUTE_SLOT),
            roomType: getExpectedRoomType(viewerRole, INSTITUTE_SLOT),
        },
        {
            slot: TEACHER_SLOT,
            room: teacherRoom,
            id: teacherRoom?.id || `${TEACHER_SLOT}-placeholder`,
            title: roomDisplayName(TEACHER_SLOT, teacherName),
            teacherName: teacherName || TEACHER_DISPLAY_NAME,
            roomType: getExpectedRoomType(viewerRole, TEACHER_SLOT),
        },
    ];
};

const buildRoomQueries = ({ authUid, parentDocId }) => {
    const descriptors = [];
    const addDescriptor = (field, operator, value) => {
        const normalizedValue = String(value || '');
        if (!normalizedValue) return;
        const queryShape = { collection: 'chatRooms', where: [field, operator, normalizedValue] };
        if (descriptors.some((descriptor) => descriptor.key === JSON.stringify(queryShape))) return;
        descriptors.push({
            key: JSON.stringify(queryShape),
            queryShape,
            ref: query(collection(db, 'chatRooms'), where(field, operator, normalizedValue)),
        });
    };

    addDescriptor('participantIds', 'array-contains', authUid);
    addDescriptor('participantIds', 'array-contains', parentDocId);
    addDescriptor('parentUid', '==', authUid);
    addDescriptor('parentId', '==', parentDocId);

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
    const activeStudentId = String(studentId || studentQueryFields.id || '');
    const messengerSlots = useMemo(() => buildMessengerSlots(rooms, teacherCandidates, {
        viewerRole,
        authUid,
        studentId: activeStudentId,
    }), [rooms, teacherCandidates, viewerRole, authUid, activeStudentId]);
    const currentSlot = selectedSlot ? messengerSlots.find((slot) => slot.slot === selectedSlot.slot) || selectedSlot : null;
    const selectedRoomId = currentSlot?.room?.id || '';
    const handleSelectSlot = (slot) => {
        if (slot?.slot === INSTITUTE_SLOT && slot?.room) {
            console.log('[parent messenger] selected institute room', {
                roomId: slot.room.id,
                roomType: slot.room.roomType,
                channel: slot.room.channel,
                participantIds: getParticipantIds(slot.room),
                parentUid: slot.room.parentUid,
                studentId: slot.room.studentId,
            });
        }
        setSelectedSlot(slot);
    };
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

            const descriptors = buildRoomQueries({ authUid, parentDocId });
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
    }, [authUid]);

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
                        studentId={activeStudentId}
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
                            targetName: currentSlot?.slot === TEACHER_SLOT ? (currentSlot?.teacherName || TEACHER_DISPLAY_NAME) : INSTITUTE_NAME,
                            roomType: currentSlot?.roomType || getExpectedRoomType(viewerRole, currentSlot?.slot),
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
                    <button key={slot.id} type="button" onClick={() => handleSelectSlot(slot)} className="h-16 w-full px-4 bg-white border-b border-gray-100 flex items-center gap-3 text-left">
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