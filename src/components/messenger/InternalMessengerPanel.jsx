import React, { useEffect, useMemo, useState } from 'react';
import {
    broadcastChatMessage,
    createOrGetChatRoom,
    sendChatMessage,
    subscribeChatMessages,
    subscribeInternalChatRooms,
} from '../../domain/messenger/messenger.service';
import { isStaffOrTeachingRole } from '../../constants/roles';
import ChatRoomList from './ChatRoomList';
import ChatMessagePane from './ChatMessagePane';
import {
    buildMessengerTargets,
    groupStudentTargetsByClass,
} from './messengerTargets';

export default function InternalMessengerPanel({
    userId,
    userRole,
    students = [],
    parents = [],
    classes = [],
}) {
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [targetUid, setTargetUid] = useState('');
    const [broadcastText, setBroadcastText] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [selectedTargetUids, setSelectedTargetUids] = useState([]);
    const [studentSearchQuery, setStudentSearchQuery] = useState('');

    const targetOptions = useMemo(() => buildMessengerTargets({
        students,
        parents,
        classes,
    }), [students, parents, classes]);

    const normalizedStudentQuery = studentSearchQuery.trim().toLowerCase();

    const filteredTargets = useMemo(() => {
        if (!normalizedStudentQuery) return targetOptions;

        return targetOptions.filter((target) => {
            if (target.role === 'student') {
                return target.searchText.includes(normalizedStudentQuery);
            }
            return target.searchText.includes(normalizedStudentQuery);
        });
        }, [normalizedStudentQuery, targetOptions]);

    const studentSections = useMemo(() => (
        groupStudentTargetsByClass(filteredTargets, classes)
    ), [filteredTargets, classes]);

    const parentTargets = useMemo(() => (
        filteredTargets
            .filter((target) => target.role === 'parent')
            .sort((left, right) => String(right.displayName || '').localeCompare(String(left.displayName || ''), 'ko'))
    ), [filteredTargets]);

    useEffect(() => {
        if (!isStaffOrTeachingRole(userRole) || !userId) return () => {};
        return subscribeInternalChatRooms(userId, setRooms, (error) => {
            console.error('[internal-messenger] room subscribe failed', error);
        });
    }, [userId, userRole]);

    useEffect(() => {
        if (!selectedRoom?.id) {
            setMessages([]);
            return () => {};
        }

        return subscribeChatMessages(selectedRoom.id, setMessages, (error) => {
            console.error('[internal-messenger] message subscribe failed', error);
        });
    }, [selectedRoom?.id]);

    const handleCreateOrOpenRoom = async (nextTargetUid = null) => {
        const resolvedTargetUid = nextTargetUid || targetUid;
        if (!resolvedTargetUid) return;
        const target = targetOptions.find((option) => option.authUid === resolvedTargetUid);
        if (!target) return;

        try {
            const result = await createOrGetChatRoom({
                targetAuthUid: target.authUid,
                targetUserDocId: target.userDocId,
                targetRole: target.role,
                targetName: target.displayName,
                studentId: target.studentId || null,
                parentId: target.parentId || null,
            });

            setTargetUid(resolvedTargetUid);
            setStatusMessage(`채팅방 준비 완료: ${result?.roomId || ''}`);
            if (result?.roomId) {
                setSelectedRoom((prev) => (prev?.id === result.roomId ? prev : { id: result.roomId }));
            }
        } catch (error) {
            console.error('[internal-messenger] create room failed', error);
            setStatusMessage(`채팅방 생성 실패: ${error.message}`);
        }
    };

    const handleSendMessage = async (text) => {
        if (!selectedRoom?.id) return;
        await sendChatMessage({ roomId: selectedRoom.id, text });
    };

    const toggleTargetSelection = (authUid) => {
        setSelectedTargetUids((prev) => {
            if (prev.includes(authUid)) return prev.filter((item) => item !== authUid);
            return [...prev, authUid];
        });
    };

    const clearSelection = () => setSelectedTargetUids([]);

    const handleBroadcastToSelected = async () => {
        const text = broadcastText.trim();
        if (!text) {
            setStatusMessage('발송할 메시지를 입력하세요.');
            return;
        }

        const targetUserIds = selectedTargetUids.filter(Boolean);
        if (!targetUserIds.length) {
            setStatusMessage('선택된 대상이 없습니다.');
            return;
        }

        const confirmed = window.confirm(`선택한 ${targetUserIds.length}명에게 동일 메시지를 발송할까요?`);
        if (!confirmed) return;

        try {
            const result = await broadcastChatMessage({
                text,
                targetUserIds,
                targetType: 'custom',
            });
            setStatusMessage(`선택 발송 완료: ${result?.successCount || 0}건`);
            setBroadcastText('');
            setSelectedTargetUids([]);
        } catch (error) {
            console.error('[internal-messenger] broadcast failed', error);
            setStatusMessage(`선택 발송 실패: ${error.message}`);
        }
    };

    if (!isStaffOrTeachingRole(userRole)) {
        return <div className="bg-white p-4 rounded-xl shadow text-sm text-gray-500">내부 운영자만 접근 가능합니다.</div>;
    }

    const hasTargets = targetOptions.length > 0;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">메신저 대상 선택 (내부 운영용)</p>

                <div className="flex items-center gap-2">
                    <input
                        value={studentSearchQuery}
                        onChange={(event) => setStudentSearchQuery(event.target.value)}
                        placeholder="학생 검색"
                        className="border rounded px-3 py-2 text-sm min-w-[220px]"
                    />
                    <span className="text-xs text-gray-500">선택 {selectedTargetUids.length}명</span>
                    <button type="button" onClick={clearSelection} className="px-2 py-1 text-xs rounded border border-gray-300">선택 해제</button>
                </div>

                <div className="border rounded-lg max-h-[260px] overflow-y-auto">
                    {!hasTargets && <p className="text-sm text-gray-400 px-3 py-6">선택 가능한 대상이 없습니다.</p>}

                    {hasTargets && studentSections.length === 0 && normalizedStudentQuery && (
                        <p className="text-sm text-gray-400 px-3 py-6">학생 검색 결과가 없습니다.</p>
                    )}

                    {studentSections.map((section) => (
                        <div key={section.key} className="border-b last:border-b-0">
                            <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600">[{section.title}]</div>
                            {section.items.map((target) => {
                                const checked = selectedTargetUids.includes(target.authUid);
                                const isFocused = targetUid === target.authUid;
                                return (
                                    <label key={target.authUid} className={`px-3 py-2 flex items-center gap-2 text-sm border-t first:border-t-0 ${isFocused ? 'bg-green-50' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleTargetSelection(target.authUid)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setTargetUid(target.authUid)}
                                            className="text-left flex-1 text-gray-700 truncate"
                                        >
                                            {target.displayName}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCreateOrOpenRoom(target.authUid)}
                                            className="px-2 py-1 text-xs rounded border border-gray-300 shrink-0"
                                        >
                                            1:1 열기
                                        </button>
                                    </label>
                                );
                            })}
                        </div>
                    ))}

                    {parentTargets.length > 0 && (
                        <div>
                            <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600">[학부모]</div>
                            {parentTargets.map((target) => {
                                const checked = selectedTargetUids.includes(target.authUid);
                                const isFocused = targetUid === target.authUid;
                                return (
                                    <label key={target.authUid} className={`px-3 py-2 flex items-center gap-2 text-sm border-t ${isFocused ? 'bg-green-50' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleTargetSelection(target.authUid)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setTargetUid(target.authUid)}
                                            className="text-left flex-1 text-gray-700 truncate"
                                        >
                                            {target.displayName}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCreateOrOpenRoom(target.authUid)}
                                            className="px-2 py-1 text-xs rounded border border-gray-300 shrink-0"
                                        >
                                            1:1 열기
                                        </button>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <textarea
                        value={broadcastText}
                        onChange={(event) => setBroadcastText(event.target.value)}
                        placeholder="선택 대상 fan-out 메시지 입력"
                        rows={3}
                        className="border rounded px-3 py-2 text-sm min-w-[260px] flex-1 resize-y"
                    />
                    <button type="button" onClick={handleBroadcastToSelected} className="px-3 py-2 text-sm rounded border border-gray-300">선택 대상에게 발송</button>
                </div>
                {statusMessage && <p className="text-xs text-gray-500">{statusMessage}</p>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                    <ChatRoomList rooms={rooms} selectedRoomId={selectedRoom?.id || null} onSelectRoom={setSelectedRoom} myUid={userId} />
                </div>
                <div className="lg:col-span-2">
                    <ChatMessagePane room={selectedRoom} messages={messages} myUid={userId} onSend={handleSendMessage} />
                </div>
            </div>
        </div>
    );
}