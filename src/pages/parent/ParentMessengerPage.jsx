import React, { useMemo, useState } from 'react';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import StudentMessenger from '../../components/StudentMessenger';
import { auth } from '../../firebase/client';
import { INSTITUTE_AUTH_UID, ROOM_TYPES, SLOTS, TEACHER_AUTH_UID } from '../../messenger/constants/messengerConstants';
import { useMessengerRooms } from '../../messenger/hooks/useMessengerRooms';
import { getInstituteDisplayName, getTeacherDisplayName } from '../../messenger/services/displayNameService';
import { getLastMessagePreview } from '../../messenger/services/roomPreviewService';
import { buildParentParticipantKeys } from '../../messenger/utils/participantKeys';
import { toDate } from '../../messenger/utils/roomMatcher';

const getExpectedRoomType = (slot) => (slot === SLOTS.INSTITUTE ? ROOM_TYPES.PARENT_INSTITUTE : ROOM_TYPES.PARENT_TEACHER);

export default function ParentMessengerPage({ studentId, student, onBack, viewerRole = 'parent' }) {
    const [selectedSlot, setSelectedSlot] = useState(null);
    const authUid = String(auth.currentUser?.uid || '');
    const studentWithId = useMemo(() => ({ ...student, id: student?.id || studentId }), [student, studentId]);
    const { loading, error, participantKeys, teacherRoom, instituteRoom } = useMessengerRooms({
        role: viewerRole === 'student' ? 'student' : 'parent',
        authUid,
        student: studentWithId,
        parent: { authUid },
    });
    const participantKeyCandidates = useMemo(() => (
        participantKeys?.length ? participantKeys : buildParentParticipantKeys({ authUid, student, studentId })
    ), [participantKeys, authUid, student, studentId]);
    const activeStudentId = String(studentId || student?.id || student?.studentId || '');

    const roomTypes = viewerRole === 'student'
        ? { institute: ROOM_TYPES.STUDENT_INSTITUTE, teacher: ROOM_TYPES.STUDENT_TEACHER }
        : { institute: ROOM_TYPES.PARENT_INSTITUTE, teacher: ROOM_TYPES.PARENT_TEACHER };

    const messengerSlots = useMemo(() => [
        { slot: SLOTS.INSTITUTE, room: instituteRoom, id: instituteRoom?.id || 'institute-placeholder', title: getInstituteDisplayName(), roomType: roomTypes.institute },
        { slot: SLOTS.TEACHER, room: teacherRoom, id: teacherRoom?.id || 'teacher-placeholder', title: getTeacherDisplayName(), teacherName: getTeacherDisplayName(), roomType: roomTypes.teacher },
    ], [teacherRoom, instituteRoom, roomTypes.institute, roomTypes.teacher]);

    const currentSlot = selectedSlot ? messengerSlots.find((slot) => slot.slot === selectedSlot.slot) || selectedSlot : null;

    if (currentSlot) {
        const currentSlotTargetAuthUid = currentSlot.slot === SLOTS.TEACHER ? TEACHER_AUTH_UID : INSTITUTE_AUTH_UID;
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
                        userRole={viewerRole}
                        allowLegacyResolve={false}
                        emptyMessage="아직 대화 내역이 없습니다."
                        chatSlot={currentSlot.slot}
                        roomCreationContext={{
                            slot: currentSlot.slot,
                            studentParticipantKeys: participantKeyCandidates,
                            targetAuthUid: currentSlotTargetAuthUid,
                            targetName: currentSlot.title,
                            roomType: currentSlot.roomType || getExpectedRoomType(currentSlot.slot),
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
