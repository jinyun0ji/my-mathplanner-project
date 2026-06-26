import React, { useEffect, useMemo, useState } from 'react';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import StudentMessenger from '../../components/StudentMessenger';
import { auth, db } from '../../firebase/client';

const INSTITUTE_SLOT = 'institute';
const TEACHER_SLOT = 'teacher';
const INSTITUTE_NAME = '채수용 수학 연구소';
const INSTITUTE_AUTH_UID = 'lVwBt6If6JVwkop9uPIbOIHQmwg2';
const TEACHER_AUTH_UID = 'EzOXjwwyATO2sP5yuc3CkS3oRw22';
const TEACHER_DISPLAY_NAME = '채수용 선생님';
const STUDENT_ROOM_TYPES = new Set(['student_institute', 'student_teacher']);

const normalizeText = (value) => String(value || '').trim();
const uniqueStrings = (values) => Array.from(new Set(
    values.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
));
const getParticipantIds = (room) => (Array.isArray(room?.participantIds) ? room.participantIds.map(String) : []);
const getRoomType = (room) => normalizeText(room?.roomType || room?.channel);
const getRoomSlot = (room) => {
    const explicitSlot = normalizeText(room?.slot);
    if (explicitSlot) return explicitSlot;
    const roomType = getRoomType(room);
    if (roomType.endsWith('_institute') || roomType === 'institute') return INSTITUTE_SLOT;
    if (roomType.endsWith('_teacher') || roomType === 'teacher') return TEACHER_SLOT;
    return '';
};
const getExpectedRoomType = (slot) => (slot === INSTITUTE_SLOT ? 'student_institute' : 'student_teacher');
const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const getRoomSortTime = (room) => (
    toDate(room?.lastMessageAt)?.getTime()
    || toDate(room?.updatedAt)?.getTime()
    || toDate(room?.createdAt)?.getTime()
    || 0
);
const getLastMessagePreview = (room) => (
    normalizeText(room?.lastMessageText)
    || normalizeText(room?.lastMessage)
    || normalizeText(room?.message)
    || '대화 내역이 없습니다.'
);
const sortRooms = (roomList) => roomList.sort((a, b) => getRoomSortTime(b) - getRoomSortTime(a));
const hasCounterpartUid = (room, targetAuthUid, fields) => {
    const target = String(targetAuthUid || '');
    if (!target) return false;
    return fields.some((field) => String(room?.[field] || '') === target) || getParticipantIds(room).includes(target);
};
const hasStudentParticipant = (room, participantKeyCandidates) => {
    const participantIds = getParticipantIds(room);
    return uniqueStrings(participantKeyCandidates).some((key) => participantIds.includes(key));
};
const isStudentRoomType = (room, expectedRoomType) => {
    const roomType = normalizeText(room?.roomType);
    const channel = normalizeText(room?.channel);
    return roomType === expectedRoomType || channel === expectedRoomType;
};
const isStudentInstituteRoom = (room, participantKeyCandidates) => {
    if (!room) return false;
    if (getRoomSlot(room) === TEACHER_SLOT || isStudentRoomType(room, 'student_teacher')) return false;
    const hasInstituteMarker = isStudentRoomType(room, 'student_institute')
        || getRoomSlot(room) === INSTITUTE_SLOT
        || hasCounterpartUid(room, INSTITUTE_AUTH_UID, ['staffAuthUid', 'counterpartUid']);
    return hasInstituteMarker
        && hasCounterpartUid(room, INSTITUTE_AUTH_UID, ['staffAuthUid', 'counterpartUid'])
        && hasStudentParticipant(room, participantKeyCandidates);
};
const isStudentTeacherRoom = (room, participantKeyCandidates) => {
    if (!room) return false;
    if (getRoomSlot(room) === INSTITUTE_SLOT || isStudentRoomType(room, 'student_institute')) return false;
    const hasTeacherMarker = isStudentRoomType(room, 'student_teacher')
        || getRoomSlot(room) === TEACHER_SLOT
        || hasCounterpartUid(room, TEACHER_AUTH_UID, ['teacherAuthUid', 'counterpartUid']);
    return hasTeacherMarker
        && hasCounterpartUid(room, TEACHER_AUTH_UID, ['teacherAuthUid', 'counterpartUid'])
        && hasStudentParticipant(room, participantKeyCandidates);
};
const getTeacherName = (room) => {
    const roomName = normalizeText(room?.teacherName || room?.staffName || room?.counterpartName || room?.name || room?.title);
    return roomName && !roomName.includes('연구소') ? roomName : TEACHER_DISPLAY_NAME;
};

export default function StudentMessengerPage({ studentId, student, onBack }) {
    const [rooms, setRooms] = useState([]);
    const [error, setError] = useState('');
    const [selectedSlot, setSelectedSlot] = useState(null);
    const authUid = String(auth.currentUser?.uid || '');
    const participantKeyCandidates = useMemo(() => uniqueStrings([
        authUid,
        student?.id,
        student?.studentId,
        student?.authUid,
        student?.uid,
        student?.userUid,
        student?.studentUid,
    ]), [authUid, student?.id, student?.studentId, student?.authUid, student?.uid, student?.userUid, student?.studentUid]);
    const activeStudentId = String(studentId || student?.id || student?.studentId || '');

    useEffect(() => {
        if (!authUid) return undefined;
        let isMounted = true;
        const roomMap = new Map();
        const unsubscribers = [];
        const applyRooms = () => {
            if (!isMounted) return;
            setRooms(sortRooms(Array.from(roomMap.values()).filter((room) => STUDENT_ROOM_TYPES.has(getRoomType(room)))));
            setError('');
        };

        participantKeyCandidates.forEach((participantKey) => {
            const roomQuery = query(collection(db, 'chatRooms'), where('participantIds', 'array-contains', participantKey));
            const unsubscribe = onSnapshot(roomQuery, (snap) => {
                snap.docs.forEach((docSnap) => roomMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
                applyRooms();
            }, (snapshotError) => {
                console.error('[student messenger page] failed to load chatRooms', {
                    authUid,
                    queryShape: { collection: 'chatRooms', where: ['participantIds', 'array-contains', participantKey] },
                    code: snapshotError?.code,
                    message: snapshotError?.message,
                });
                if (isMounted && roomMap.size === 0) setError('대화 목록을 불러오지 못했습니다.');
            });
            unsubscribers.push(unsubscribe);
        });

        return () => {
            isMounted = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
        };
    }, [authUid, participantKeyCandidates]);

    const messengerSlots = useMemo(() => {
        const sortedRooms = sortRooms([...rooms]);
        const instituteRoom = sortedRooms.find((room) => isStudentInstituteRoom(room, participantKeyCandidates)) || null;
        const teacherRoom = sortedRooms.find((room) => isStudentTeacherRoom(room, participantKeyCandidates)) || null;
        return [
            { slot: INSTITUTE_SLOT, id: instituteRoom?.id || 'institute-placeholder', title: INSTITUTE_NAME, room: instituteRoom, roomType: 'student_institute' },
            { slot: TEACHER_SLOT, id: teacherRoom?.id || 'teacher-placeholder', title: getTeacherName(teacherRoom), room: teacherRoom, roomType: 'student_teacher' },
        ];
    }, [rooms, participantKeyCandidates]);

    const currentSlot = selectedSlot ? messengerSlots.find((slot) => slot.slot === selectedSlot.slot) || selectedSlot : null;
    if (currentSlot) {
        const targetAuthUid = currentSlot.slot === TEACHER_SLOT ? TEACHER_AUTH_UID : INSTITUTE_AUTH_UID;
        return (
            <div className="h-screen min-h-screen bg-gray-50 flex flex-col overflow-hidden">
                <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
                    <button type="button" onClick={() => setSelectedSlot(null)} className="text-gray-700"><ArrowBackIosNewIcon style={{ fontSize: 18 }} /></button>
                    <h1 className="text-base font-semibold text-gray-900 truncate">{currentSlot.title}</h1>
                </header>
                <div className="flex-1 min-h-0">
                    <StudentMessenger
                        studentId={activeStudentId}
                        studentAuthUid={student?.authUid || student?.studentUid || student?.uid || ''}
                        selectedRoomId={currentSlot.room?.id || ''}
                        teacherName={currentSlot.title}
                        userRole="student"
                        allowLegacyResolve={false}
                        emptyMessage="아직 대화 내역이 없습니다."
                        chatSlot={currentSlot.slot}
                        roomCreationContext={{
                            slot: currentSlot.slot,
                            studentParticipantKeys: participantKeyCandidates,
                            targetAuthUid,
                            targetName: currentSlot.slot === TEACHER_SLOT ? currentSlot.title : INSTITUTE_NAME,
                            roomType: getExpectedRoomType(currentSlot.slot),
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen min-h-screen bg-gray-50 overflow-y-auto">
            <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3 sticky top-0">
                <button type="button" onClick={onBack} className="text-gray-700"><ArrowBackIosNewIcon style={{ fontSize: 18 }} /></button>
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
