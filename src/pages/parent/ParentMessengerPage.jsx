import React, { useEffect, useMemo, useState } from 'react';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import StudentMessenger from '../../components/StudentMessenger';
import { auth, db } from '../../firebase/client';
import { INSTITUTE_AUTH_UID, ROOM_TYPES, SLOTS, TEACHER_AUTH_UID } from '../../messenger/constants/messengerConstants';
import { getInstituteDisplayName, getTeacherDisplayName } from '../../messenger/services/displayNameService';
import { getLastMessagePreview } from '../../messenger/services/roomPreviewService';
import { buildParentParticipantKeys } from '../../messenger/utils/participantKeys';
import { getRoomSlot, hasRoomTypeOrChannel, sortRooms, toDate } from '../../messenger/utils/roomMatcher';

const getParticipantIds = (room) => (Array.isArray(room?.participantIds) ? room.participantIds.map(String) : []);
const hasTarget = (room, targetUid, fields = []) => fields.some((field) => String(room?.[field] || '') === targetUid) || getParticipantIds(room).includes(targetUid);
const hasViewerParticipant = (room, participantKeys = []) => participantKeys.some((key) => getParticipantIds(room).includes(String(key)));
const sameStudent = (room, studentId) => !room?.studentId || !studentId || String(room.studentId) === String(studentId);

const isParentTeacherRoom = (room, participantKeys, studentId) => (
    hasViewerParticipant(room, participantKeys)
    && sameStudent(room, studentId)
    && !hasRoomTypeOrChannel(room, ROOM_TYPES.STUDENT_TEACHER)
    && !hasRoomTypeOrChannel(room, ROOM_TYPES.STUDENT_INSTITUTE)
    && (hasRoomTypeOrChannel(room, ROOM_TYPES.PARENT_TEACHER) || getRoomSlot(room) === SLOTS.TEACHER)
    && hasTarget(room, TEACHER_AUTH_UID, ['teacherAuthUid', 'counterpartUid'])
);

const isParentInstituteRoom = (room, participantKeys, studentId) => (
    hasViewerParticipant(room, participantKeys)
    && sameStudent(room, studentId)
    && !hasRoomTypeOrChannel(room, ROOM_TYPES.STUDENT_TEACHER)
    && !hasRoomTypeOrChannel(room, ROOM_TYPES.STUDENT_INSTITUTE)
    && (hasRoomTypeOrChannel(room, ROOM_TYPES.PARENT_INSTITUTE) || getRoomSlot(room) === SLOTS.INSTITUTE)
    && hasTarget(room, INSTITUTE_AUTH_UID, ['staffAuthUid', 'counterpartUid'])
);

export default function ParentMessengerPage({ studentId, student, onBack }) {
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const authUid = String(auth.currentUser?.uid || '');
    const activeStudentId = String(studentId || student?.id || student?.studentId || '');
    const participantKeys = useMemo(() => buildParentParticipantKeys({ authUid, parent: { authUid, parentUid: authUid }, student, studentId: activeStudentId }), [authUid, student, activeStudentId]);

    useEffect(() => {
        if (!authUid) {
            setRooms([]);
            setLoading(false);
            setError('');
            return undefined;
        }
        setLoading(true);
        setError('');
        const roomQuery = query(collection(db, 'chatRooms'), where('participantIds', 'array-contains', authUid));
        const unsubscribe = onSnapshot(roomQuery, (snap) => {
            setRooms(sortRooms(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))));
            setLoading(false);
            setError('');
        }, (snapshotError) => {
            console.error('[parent messenger] failed to load chatRooms', {
                code: snapshotError?.code,
                message: snapshotError?.message,
                queryShape: { collection: 'chatRooms', where: ['participantIds', 'array-contains', authUid] },
            });
            setLoading(false);
            setError('대화 목록을 불러오지 못했습니다.');
        });
        return unsubscribe;
    }, [authUid]);

    const teacherRoom = useMemo(() => rooms.find((room) => isParentTeacherRoom(room, participantKeys, activeStudentId)) || null, [rooms, participantKeys, activeStudentId]);
    const instituteRoom = useMemo(() => rooms.find((room) => isParentInstituteRoom(room, participantKeys, activeStudentId)) || null, [rooms, participantKeys, activeStudentId]);

    const messengerSlots = useMemo(() => [
        { slot: SLOTS.INSTITUTE, room: instituteRoom, id: instituteRoom?.id || 'parent-institute-placeholder', title: getInstituteDisplayName(), roomType: ROOM_TYPES.PARENT_INSTITUTE },
        { slot: SLOTS.TEACHER, room: teacherRoom, id: teacherRoom?.id || 'parent-teacher-placeholder', title: getTeacherDisplayName(), roomType: ROOM_TYPES.PARENT_TEACHER },
    ], [teacherRoom, instituteRoom]);

    const currentSlot = selectedSlot ? messengerSlots.find((slot) => slot.slot === selectedSlot.slot) || selectedSlot : null;

    if (currentSlot) {
        const targetAuthUid = currentSlot.slot === SLOTS.TEACHER ? TEACHER_AUTH_UID : INSTITUTE_AUTH_UID;
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
                        userRole="parent"
                        allowLegacyResolve={false}
                        emptyMessage="아직 대화 내역이 없습니다."
                        chatSlot={currentSlot.slot}
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
        <div className="h-screen min-h-screen bg-gray-50 overflow-y-auto">
            <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3 sticky top-0">
                <button type="button" onClick={onBack} className="text-gray-700"><ArrowBackIosNewIcon style={{ fontSize: 18 }} /></button>
                <h1 className="text-base font-semibold text-gray-900">메신저</h1>
            </header>
            <section className="py-2">
                {loading && <div className="mx-4 mb-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2">대화 목록을 불러오는 중입니다.</div>}
                {error && <div className="mx-4 mb-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2">{error}</div>}
                {messengerSlots.map((slot) => (
                    <button key={slot.id} type="button" onClick={() => setSelectedSlot(slot)} className="h-16 w-full px-4 bg-white border-b border-gray-100 flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{slot.title}</p>
                            <p className="text-xs text-gray-500 truncate">{String(getLastMessagePreview(slot.room))}</p>
                        </div>
                        <div className="text-[11px] text-gray-400">{toDate(slot.room?.lastMessageAt || slot.room?.updatedAt || slot.room?.createdAt)?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || ''}</div>
                    </button>
                ))}
            </section>
        </div>
    );
}
