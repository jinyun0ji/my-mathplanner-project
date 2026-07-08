import React, { useEffect, useMemo, useRef, useState } from 'react';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import StudentMessenger from '../../components/StudentMessenger';
import { auth } from '../../firebase/client';
import { INSTITUTE_AUTH_UID, ROOM_TYPES, SLOTS, TEACHER_AUTH_UID } from '../../messenger/constants/messengerConstants';
import { useMessengerRooms } from '../../messenger/hooks/useMessengerRooms';
import { getInstituteDisplayName, getTeacherDisplayName } from '../../messenger/services/displayNameService';
import { getLastMessagePreview, getLastMessagePreviewCandidates } from '../../messenger/services/roomPreviewService';
import { buildStudentParticipantKeys } from '../../messenger/utils/participantKeys';
import { getRoomDebugInfo, getRoomId, getStrictTeacherRoomMatch, toDate } from '../../messenger/utils/roomMatcher';
import { markChatRoomNotificationsRead } from '../../notifications/notificationReadActions';

const getExpectedRoomType = (slot) => (slot === SLOTS.INSTITUTE ? ROOM_TYPES.STUDENT_INSTITUTE : ROOM_TYPES.STUDENT_TEACHER);

export default function StudentMessengerPage({ studentId, student, onBack, notificationViewerUid = '', initialRoomId = '', onInitialRoomConsumed = null, notifications = [], setNotifications = null }) {
    const [selectedSlot, setSelectedSlot] = useState(null);
    const hasConsumedInitialRoomRef = useRef(false);
    const authUid = String(auth.currentUser?.uid || '');
    const studentWithId = useMemo(() => ({ ...student, id: student?.id || studentId }), [student, studentId]);
    const { loading, error, participantKeys, teacherRoom, instituteRoom, rooms = [] } = useMessengerRooms({
        role: 'student',
        authUid,
        student: studentWithId,
    });
    const participantKeyCandidates = useMemo(() => (
        participantKeys?.length ? participantKeys : buildStudentParticipantKeys({ authUid, student, studentId })
    ), [participantKeys, authUid, student, studentId]);
    const activeStudentId = String(studentId || student?.id || student?.studentId || '');

    const messengerSlots = useMemo(() => [
        { slot: SLOTS.INSTITUTE, id: instituteRoom?.id || 'institute-placeholder', title: getInstituteDisplayName(), room: instituteRoom, roomType: ROOM_TYPES.STUDENT_INSTITUTE },
        { slot: SLOTS.TEACHER, id: teacherRoom?.id || 'teacher-placeholder', title: getTeacherDisplayName(), room: teacherRoom, roomType: ROOM_TYPES.STUDENT_TEACHER },
    ], [teacherRoom, instituteRoom]);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;
        messengerSlots.forEach((slot) => {
            console.log('[student messenger slot]', {
                role: 'student',
                slot: slot.slot,
                expectedRoomType: slot.roomType,
                activeStudentId,
                participantKeys: participantKeyCandidates,
                selectedRoomId: getRoomId(slot.room),
                finalPreviewRoomId: getRoomId(slot.room),
                finalPreviewText: slot.room ? getLastMessagePreview(slot.room) : '대화 내역이 없습니다.',
                rejectedRooms: rooms
                    .filter((room) => getRoomId(room) !== getRoomId(slot.room))
                    .map((room) => {
                        const match = slot.slot === SLOTS.TEACHER
                            ? getStrictTeacherRoomMatch(room, { role: 'student', expectedRoomType: slot.roomType, viewerKeys: [authUid, participantKeyCandidates], studentKeys: [authUid, activeStudentId, participantKeyCandidates], studentId: activeStudentId, teacherAuthUid: TEACHER_AUTH_UID })
                            : { reason: 'not selected for this slot' };
                        return { roomId: getRoomId(room), reason: match.reason || 'not selected for this slot', actual: getRoomDebugInfo(room) };
                    }),
                acceptedRoom: slot.room ? getRoomDebugInfo(slot.room) : null,
                roomType: slot.room?.roomType || '',
                channel: slot.room?.channel || '',
                roomSlot: slot.room?.slot || '',
            });
        });
    }, [messengerSlots, activeStudentId, participantKeyCandidates, rooms]);

    useEffect(() => {
        const normalizedInitialRoomId = String(initialRoomId || '').trim();
        if (!normalizedInitialRoomId || selectedSlot || hasConsumedInitialRoomRef.current) return;
        const targetSlot = messengerSlots.find((slot) => String(slot.room?.roomId || slot.room?.id || '').trim() === normalizedInitialRoomId);
        hasConsumedInitialRoomRef.current = true;
        if (typeof onInitialRoomConsumed === 'function') onInitialRoomConsumed();
        handleOpenRoom(targetSlot || {
            slot: SLOTS.TEACHER,
            id: normalizedInitialRoomId,
            title: getTeacherDisplayName(),
            roomType: ROOM_TYPES.STUDENT_TEACHER,
            room: { id: normalizedInitialRoomId, roomId: normalizedInitialRoomId },
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRoomId, messengerSlots, selectedSlot, onInitialRoomConsumed]);

    const handleOpenRoom = (slot) => {
        const selectedRoomId = String(slot.room?.roomId || slot.room?.id || '').trim();
        if (process.env.NODE_ENV === 'development') {
            console.log('[MessengerPage] room preview candidates', {
                role: 'student',
                roomId: selectedRoomId,
                title: slot.title,
                userChatRoomsIndexPath: authUid && selectedRoomId ? `userChatRooms/${authUid}/rooms/${selectedRoomId}` : '',
                candidates: getLastMessagePreviewCandidates(slot.room),
                selectedPreview: getLastMessagePreview(slot.room),
                room: slot.room,
            });
            console.log('[MessengerPage] open room', {
                role: 'student',
                selectedRoomId,
                roomIdFromIndex: String(slot.room?.roomId || ''),
                roomDocId: String(slot.room?.id || ''),
                slot: slot.slot,
                roomType: slot.room?.roomType || slot.roomType || '',
            });
        }
        setSelectedSlot((prev) => {
            const previousRoomId = String(prev?.room?.roomId || prev?.room?.id || '').trim();
            if (selectedRoomId && previousRoomId === selectedRoomId) return prev;
            return slot;
        });
        if (selectedRoomId && notificationViewerUid) {
            markChatRoomNotificationsRead({ viewerUid: notificationViewerUid, roomId: selectedRoomId, notifications, setNotifications })
                .catch((error) => console.warn('[student][notifications] mark chat room read failed', error));
        }
    };

    const currentSlot = selectedSlot
        ? messengerSlots.find((slot) => getRoomId(slot.room) && getRoomId(slot.room) === getRoomId(selectedSlot.room))
            || (getRoomId(selectedSlot.room) ? selectedSlot : messengerSlots.find((slot) => slot.slot === selectedSlot.slot) || selectedSlot)
        : null;
    if (currentSlot) {
        const targetAuthUid = currentSlot.slot === SLOTS.TEACHER ? TEACHER_AUTH_UID : INSTITUTE_AUTH_UID;
        const currentRoomId = String(currentSlot.room?.roomId || currentSlot.room?.id || '').trim();
        const canCreateCurrentRoom = Boolean(targetAuthUid && getExpectedRoomType(currentSlot.slot));
        if (!currentRoomId && !canCreateCurrentRoom) {
            return (
                <div className="mobile-screen mobile-keyboard-screen mobile-chat-screen bg-gray-50 flex flex-col overflow-hidden">
                    <header className="mobile-header bg-white border-b border-gray-100 px-4 flex items-center gap-3">
                        <button type="button" onClick={() => { hasConsumedInitialRoomRef.current = true; setSelectedSlot(null); }} className="mobile-back-button text-gray-700"><ArrowBackIosNewIcon style={{ fontSize: 18 }} /></button>
                        <h1 className="text-base font-semibold text-gray-900 truncate">{currentSlot.title}</h1>
                    </header>
                    <div className="flex-1 flex items-center justify-center text-sm text-gray-500">대화방을 준비 중입니다.</div>
                </div>
            );
        }
        return (
            <div className="mobile-screen mobile-keyboard-screen mobile-chat-screen bg-gray-50 flex flex-col overflow-hidden">
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
                        userRole="student"
                        allowLegacyResolve={!currentRoomId}
                        emptyMessage="아직 대화 내역이 없습니다."
                        chatSlot={currentSlot.slot}
                        notificationViewerUid={notificationViewerUid}
                        notifications={notifications}
                        setNotifications={setNotifications}
                        roomCreationContext={{
                            slot: currentSlot.slot,
                            studentParticipantKeys: participantKeyCandidates,
                            targetAuthUid,
                            targetName: currentSlot.title,
                            roomType: getExpectedRoomType(currentSlot.slot),
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="mobile-screen min-h-[100dvh] bg-gray-50 overflow-y-auto">
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
                            <p className="text-xs text-gray-500 truncate">{String(getLastMessagePreview(slot.room))}</p>
                        </div>
                        <div className="text-[11px] text-gray-400">{toDate(slot.room?.lastMessageAt || slot.room?.updatedAt || slot.room?.createdAt)?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || ''}</div>
                    </button>
                ))}
            </section>
        </div>
    );
}
