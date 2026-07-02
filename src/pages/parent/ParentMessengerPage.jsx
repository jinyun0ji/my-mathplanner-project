import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import StudentMessenger from '../../components/StudentMessenger';
import { auth, db } from '../../firebase/client';
import { INSTITUTE_AUTH_UID, ROOM_TYPES, SLOTS, TEACHER_AUTH_UID } from '../../messenger/constants/messengerConstants';
import { getInstituteDisplayName, getTeacherDisplayName } from '../../messenger/services/displayNameService';
import { getLastMessagePreview, getLastMessagePreviewCandidates } from '../../messenger/services/roomPreviewService';
import { buildParentParticipantKeys } from '../../messenger/utils/participantKeys';
import { getRoomDebugInfo, getRoomId, isLegacySlotRoomTypeMatch, sortRooms, toDate } from '../../messenger/utils/roomMatcher';
import { getUserChatRoomsQueryShape, subscribeUserChatRooms } from '../../messenger/services/userChatRoomsService';
import { markChatRoomNotificationsRead } from '../../notifications/notificationReadActions';

const getParticipantIds = (room) => (Array.isArray(room?.participantIds) ? room.participantIds.map(String) : []);
const hasTarget = (room, targetUid, fields = []) => fields.some((field) => String(room?.[field] || '') === targetUid) || getParticipantIds(room).includes(targetUid);
const hasViewerParticipant = (room, participantKeys = [], linkedUserDocId = '', studentId = '') => {
    const participantIds = getParticipantIds(room);
    const keys = participantKeys.map(String);
    return keys.some((key) => participantIds.includes(key))
        || (linkedUserDocId && String(room?.parentId || '') === String(linkedUserDocId))
        || (studentId && String(room?.studentId || '') === String(studentId))
        || keys.includes(String(room?.parentUid || ''))
};


const sameStudent = (room, studentId) => !room?.studentId || !studentId || String(room.studentId) === String(studentId);
const hasExactStudent = (room, studentId) => Boolean(studentId) && String(room?.studentId || '') === String(studentId);
const hasLinkedParent = (room, linkedUserDocId) => {
    const parentDocId = String(linkedUserDocId || '').trim();
    if (!parentDocId) return false;
    return String(room?.parentId || '') === parentDocId
        || String(room?.parentUid || '') === parentDocId
        || getParticipantIds(room).includes(parentDocId);
};
const isTeacherRoomShape = (room) => (
    String(room?.slot || '') === 'teacher'
    || String(room?.channel || '') === 'teacher'
    || String(room?.roomType || '') === 'teacher'
    || String(room?.roomType || '') === ROOM_TYPES.PARENT_TEACHER
);

const logParentRoomRejection = (room, expectedRoomType, reason, selectedRoomId = '') => {
    if (process.env.NODE_ENV !== 'development') return;
    console.log('[parent messenger] rejected room candidate', {
        role: 'parent',
        expectedRoomType,
        selectedRoomId,
        rejectedRoomId: room?.roomId || room?.id || '',
        reason,
        actual: getRoomDebugInfo(room),
    });
};

const isParentRoomOfType = (room, expectedRoomType, targetUid, targetFields, participantKeys, studentId, linkedUserDocId) => {
    const selectedRoomId = getRoomId(room);
    if (!isLegacySlotRoomTypeMatch(room, expectedRoomType)) {
        logParentRoomRejection(room, expectedRoomType, 'roomType/channel mismatch', selectedRoomId);
        return false;
    }
    if (room?.__unreadableRoom && selectedRoomId) {
        return true;
    }
    if (isLegacySlotRoomTypeMatch(room, ROOM_TYPES.STUDENT_TEACHER) || isLegacySlotRoomTypeMatch(room, ROOM_TYPES.STUDENT_INSTITUTE)) {
        logParentRoomRejection(room, expectedRoomType, 'student room type is not allowed for parent role', selectedRoomId);
        return false;
    }
    if (!hasViewerParticipant(room, participantKeys, linkedUserDocId, studentId)) {
        logParentRoomRejection(room, expectedRoomType, 'parent participant not found', selectedRoomId);
        return false;
    }
    if (!sameStudent(room, studentId)) {
        logParentRoomRejection(room, expectedRoomType, 'studentId mismatch', selectedRoomId);
        return false;
    }
    if (!hasTarget(room, targetUid, targetFields)) {
        logParentRoomRejection(room, expectedRoomType, 'target participant mismatch', selectedRoomId);
        return false;
    }
    return true;
};

const isParentTeacherRoom = (room, participantKeys, studentId, linkedUserDocId) => {
    const selectedRoomId = getRoomId(room);
    if (room?.__unreadableRoom && selectedRoomId) return true;
    if (!isTeacherRoomShape(room)) {
        logParentRoomRejection(room, ROOM_TYPES.PARENT_TEACHER, 'teacher room shape mismatch', selectedRoomId);
        return false;
    }
    if (!hasTarget(room, TEACHER_AUTH_UID, ['teacherAuthUid', 'counterpartUid'])) {
        logParentRoomRejection(room, ROOM_TYPES.PARENT_TEACHER, 'teacher target participant mismatch', selectedRoomId);
        return false;
    }
    if (!hasLinkedParent(room, linkedUserDocId)) {
        logParentRoomRejection(room, ROOM_TYPES.PARENT_TEACHER, 'linked parent not found', selectedRoomId);
        return false;
    }
    if (!hasExactStudent(room, studentId)) {
        logParentRoomRejection(room, ROOM_TYPES.PARENT_TEACHER, 'studentId mismatch', selectedRoomId);
        return false;
    }
    return true;
};

const isParentInstituteRoom = (room, participantKeys, studentId, linkedUserDocId) => isParentRoomOfType(room, ROOM_TYPES.PARENT_INSTITUTE, INSTITUTE_AUTH_UID, ['staffAuthUid', 'counterpartUid'], participantKeys, studentId, linkedUserDocId);

const buildInitialRoomSlot = (initialRoomId) => {
    const normalizedInitialRoomId = String(initialRoomId || '').trim();
    if (!normalizedInitialRoomId) return null;
    return {
        slot: SLOTS.TEACHER,
        id: normalizedInitialRoomId,
        title: getTeacherDisplayName(),
        roomType: ROOM_TYPES.PARENT_TEACHER,
        room: { id: normalizedInitialRoomId, roomId: normalizedInitialRoomId },
    };
};

export default function ParentMessengerPage({ studentId, student, onBack, notificationViewerUid = '', initialRoomId = '', notifications = [], setNotifications = null }) {
    const [selectedSlot, setSelectedSlot] = useState(() => buildInitialRoomSlot(initialRoomId));
    const hasConsumedInitialRoomRef = useRef(false);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [linkedParent, setLinkedParent] = useState({ userDocId: '', profile: {} });
    const authUid = String(auth.currentUser?.uid || '');
    const activeStudentId = String(studentId || student?.id || student?.studentId || '');
    const participantKeys = useMemo(() => buildParentParticipantKeys({
        authUid,
        parent: {
            id: linkedParent.userDocId,
            parentId: linkedParent.userDocId,
            parentDocId: linkedParent.userDocId,
            authUid,
            parentUid: authUid,
            ...(linkedParent.profile || {}),
        },
        student,
        studentId: activeStudentId,
    }), [authUid, linkedParent, student, activeStudentId]);


    useEffect(() => {
        let cancelled = false;
        if (!authUid || initialRoomId) {
            setLinkedParent({ userDocId: '', profile: {} });
            return undefined;
        }
        const loadLinkedParent = async () => {
            try {
                const indexSnap = await getDoc(doc(db, 'userAuthIndex', authUid));
                const userDocId = indexSnap.exists() ? String(indexSnap.data()?.userDocId || '').trim() : '';
                let profile = {};
                if (userDocId) {
                    const userSnap = await getDoc(doc(db, 'users', userDocId));
                    profile = userSnap.exists() ? userSnap.data() || {} : {};
                }
                if (!cancelled) setLinkedParent({ userDocId, profile });
            } catch (loadError) {
                if (process.env.NODE_ENV === 'development') console.warn('[parent messenger] failed to load linked parent profile', { authUid, code: loadError?.code, message: loadError?.message });
                if (!cancelled) setLinkedParent({ userDocId: '', profile: {} });
            }
        };
        loadLinkedParent();
        return () => { cancelled = true; };
    }, [authUid, initialRoomId]);

    useEffect(() => {
        if (!authUid || initialRoomId) {
            setRooms([]);
            setLoading(false);
            setError('');
            return undefined;
        }
        setLoading(true);
        setError('');
        const queryShape = getUserChatRoomsQueryShape(authUid);
        const ownerUid = authUid;
        console.log('[parent messenger] userChatRooms subscribe auth check', {
            authCurrentUserUid: auth.currentUser?.uid || '',
            queryOwnerUid: ownerUid,
            authUidMatchesOwnerUid: auth.currentUser?.uid === ownerUid,
        });
        if (process.env.NODE_ENV === 'development') console.log('[parent messenger] userChatRooms query', queryShape);
        const unsubscribe = subscribeUserChatRooms({
            authUid,
            role: 'parent',
            onNext: (myRooms) => {
                setRooms(sortRooms(myRooms));
                setLoading(false);
                setError('');
            },
            onError: (snapshotError) => {
                console.error('[parent messenger] failed to load userChatRooms', {
                    code: snapshotError?.code,
                    message: snapshotError?.message,
                    stage: snapshotError?.stage,
                    context: snapshotError?.context,
                    queryShape,
                });
                setLoading(false);
                setError('대화 목록을 불러오지 못했습니다.');
            },
        });
        return unsubscribe;
    }, [authUid, initialRoomId]);

    const teacherRoom = useMemo(() => rooms.find((room) => isParentTeacherRoom(room, participantKeys, activeStudentId, linkedParent.userDocId)) || null, [rooms, participantKeys, activeStudentId, linkedParent.userDocId]);
    const instituteRoom = useMemo(() => rooms.find((room) => isParentInstituteRoom(room, participantKeys, activeStudentId, linkedParent.userDocId)) || null, [rooms, participantKeys, activeStudentId, linkedParent.userDocId]);

    const messengerSlots = useMemo(() => [
        { slot: SLOTS.INSTITUTE, room: instituteRoom, id: instituteRoom?.roomId || instituteRoom?.id || 'parent-institute-placeholder', title: getInstituteDisplayName(), roomType: ROOM_TYPES.PARENT_INSTITUTE },
        { slot: SLOTS.TEACHER, room: teacherRoom, id: teacherRoom?.roomId || teacherRoom?.id || 'parent-teacher-placeholder', title: getTeacherDisplayName(), roomType: ROOM_TYPES.PARENT_TEACHER },
    ], [teacherRoom, instituteRoom]);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;
        const rejectedBySlot = messengerSlots.map((slot) => ({
            slot: slot.slot,
            expectedRoomType: slot.roomType,
            finalPreviewRoomId: getRoomId(slot.room),
            finalPreviewText: slot.room ? getLastMessagePreview(slot.room) : '대화 내역이 없습니다.',
            rejected: rooms
                .filter((room) => getRoomId(room) !== getRoomId(slot.room))
                .map((room) => ({ roomId: getRoomId(room), actual: getRoomDebugInfo(room) })),
        }));
        console.log('[parent messenger] match debug', {
            authUid,
            linkedUserDocId: linkedParent.userDocId,
            participantKeys,
            roomsCount: rooms.length,
            teacherRoomMatched: Boolean(teacherRoom),
            teacherRoomId: teacherRoom?.roomId || teacherRoom?.id || '',
            instituteRoomMatched: Boolean(instituteRoom),
            instituteRoomId: instituteRoom?.roomId || instituteRoom?.id || '',
            slots: messengerSlots.map((slot) => ({
                role: 'parent',
                slot: slot.slot,
                expectedRoomType: slot.roomType,
                finalPreviewRoomId: getRoomId(slot.room),
                finalPreviewText: slot.room ? getLastMessagePreview(slot.room) : '대화 내역이 없습니다.',
                selectedRoomId: getRoomId(slot.room),
                roomState: slot.room ? 'actual' : 'placeholder',
            })),
            rejectedBySlot,
        });
    }, [authUid, linkedParent.userDocId, participantKeys, rooms.length, teacherRoom, instituteRoom, messengerSlots]);

    useEffect(() => {
        const normalizedInitialRoomId = String(initialRoomId || '').trim();
        if (!normalizedInitialRoomId || selectedSlot || hasConsumedInitialRoomRef.current) return;
        const targetSlot = messengerSlots.find((slot) => String(slot.room?.roomId || slot.room?.id || '').trim() === normalizedInitialRoomId);
        hasConsumedInitialRoomRef.current = true;
        handleOpenRoom(targetSlot || buildInitialRoomSlot(normalizedInitialRoomId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRoomId, messengerSlots, selectedSlot]);

    const handleOpenRoom = (slot) => {
        const selectedRoomId = String(slot.room?.roomId || slot.room?.id || '').trim();
        if (process.env.NODE_ENV === 'development') {
            console.log('[MessengerPage] room preview candidates', {
                role: 'parent',
                roomId: selectedRoomId,
                title: slot.title,
                userChatRoomsIndexPath: authUid && selectedRoomId ? `userChatRooms/${authUid}/rooms/${selectedRoomId}` : '',
                candidates: getLastMessagePreviewCandidates(slot.room),
                selectedPreview: getLastMessagePreview(slot.room),
                room: slot.room,
            });
            console.log('[MessengerPage] open room', {
                role: 'parent',
                selectedRoomId,
                roomIdFromIndex: String(slot.room?.roomId || ''),
                roomDocId: String(slot.room?.id || ''),
                slot: slot.slot,
                expectedRoomType: slot.roomType,
                actual: getRoomDebugInfo(slot.room),
            });
            if (slot.slot === SLOTS.TEACHER) {
                const allowLegacyResolve = !selectedRoomId;
                console.log('[parent messenger] teacher room click', {
                    slot: slot.slot,
                    currentRoomId: selectedRoomId,
                    selectedRoomId,
                    'room.id': String(slot.room?.id || ''),
                    'room.roomId': String(slot.room?.roomId || ''),
                    'room.channel': String(slot.room?.channel || ''),
                    'room.roomType': String(slot.room?.roomType || ''),
                    'room.slot': String(slot.room?.slot || ''),
                    parentId: String(slot.room?.parentId || ''),
                    parentUid: String(slot.room?.parentUid || ''),
                    participantIds: getParticipantIds(slot.room),
                    allowLegacyResolve,
                });
            }
        }
        setSelectedSlot(slot);
        if (selectedRoomId && notificationViewerUid) {
            markChatRoomNotificationsRead({ viewerUid: notificationViewerUid, roomId: selectedRoomId, notifications, setNotifications })
                .catch((error) => console.error('[parent][notifications] mark chat room read failed', error));
        }
    };

    const currentSlot = selectedSlot
        ? messengerSlots.find((slot) => getRoomId(slot.room) && getRoomId(slot.room) === getRoomId(selectedSlot.room))
            || (getRoomId(selectedSlot.room) ? selectedSlot : messengerSlots.find((slot) => slot.slot === selectedSlot.slot) || selectedSlot)
        : null;

    useEffect(() => {
        const currentRoomId = String(currentSlot?.room?.roomId || currentSlot?.room?.id || '').trim();
        if (!currentRoomId || !window.__notificationOpenTimingActive) return;
        console.timeEnd('notification-open');
        window.__notificationOpenTimingActive = false;
    }, [currentSlot]);

    if (currentSlot) {
        const targetAuthUid = currentSlot.slot === SLOTS.TEACHER ? TEACHER_AUTH_UID : INSTITUTE_AUTH_UID;
        const currentRoomId = String(currentSlot.room?.roomId || currentSlot.room?.id || '').trim();
        return (
            <div className="mobile-screen h-screen min-h-screen bg-gray-50 flex flex-col overflow-hidden">
                <header className="mobile-header bg-white border-b border-gray-100 px-4 flex items-center gap-3">
                    <button type="button" onClick={() => { hasConsumedInitialRoomRef.current = true; setSelectedSlot(null); }} className="mobile-back-button text-gray-700"><ArrowBackIosNewIcon style={{ fontSize: 18 }} /></button>
                    <h1 className="text-base font-semibold text-gray-900 truncate">{currentSlot.title}</h1>
                </header>
                <div className="flex-1 min-h-0">
                    <StudentMessenger
                        studentId={activeStudentId}
                        studentAuthUid={student?.authUid || student?.studentUid || student?.uid || ''}
                        selectedRoomId={currentRoomId}
                        teacherName={currentSlot.title}
                        userRole="parent"
                        allowLegacyResolve={!currentRoomId}
                        emptyMessage="아직 대화 내역이 없습니다."
                        chatSlot={currentSlot.slot}
                        notificationViewerUid={notificationViewerUid}
                        notifications={notifications}
                        setNotifications={setNotifications}
                        roomCreationContext={{
                            slot: currentSlot.slot,
                            studentParticipantKeys: participantKeys,
                            targetAuthUid,
                            targetName: currentSlot.title,
                            roomType: currentSlot.roomType,
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="mobile-screen h-screen min-h-screen bg-gray-50 overflow-y-auto">
            <header className="mobile-header bg-white border-b border-gray-100 px-4 flex items-center gap-3 sticky top-0 z-30">
                <button type="button" onClick={onBack} className="mobile-back-button text-gray-700"><ArrowBackIosNewIcon style={{ fontSize: 18 }} /></button>
                <h1 className="text-base font-semibold text-gray-900">메신저</h1>
            </header>
            <section className="py-2">
                {loading && <div className="mx-4 mb-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2">대화 목록을 불러오는 중입니다.</div>}
                {error && <div className="mx-4 mb-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2">{error}</div>}
                {messengerSlots.map((slot) => (
                    <button key={slot.id} type="button" onClick={() => handleOpenRoom(slot)} className="h-16 w-full px-4 bg-white border-b border-gray-100 flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{slot.title}</p>
                            <p className="text-xs text-gray-500 truncate">{slot.room ? String(getLastMessagePreview(slot.room)) : '대화 내역이 없습니다.'}</p>
                        </div>
                        <div className="text-[11px] text-gray-400">{toDate(slot.room?.lastMessageAt || slot.room?.updatedAt || slot.room?.createdAt)?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || ''}</div>
                    </button>
                ))}
            </section>
        </div>
    );
}
