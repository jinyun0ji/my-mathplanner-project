import { useEffect, useMemo, useState } from 'react';
import { resolveParentRooms } from '../resolvers/parentResolver';
import { resolveStaffRooms } from '../resolvers/staffResolver';
import { resolveStudentRooms } from '../resolvers/studentResolver';
import { buildParentParticipantKeys, buildStudentParticipantKeys, uniqueStrings } from '../utils/participantKeys';
import { sortRooms } from '../utils/roomMatcher';
import { getUserChatRoomsQueryShape, subscribeUserChatRooms } from '../services/userChatRoomsService';

const log = (...args) => {
    if (process.env.NODE_ENV === 'development') console.log('[resolver]', ...args);
};

const logChatRoomsQuery = (role, authUid) => {
    if (process.env.NODE_ENV !== 'development') return;
    const queryShape = getUserChatRoomsQueryShape(authUid);
    if (role === 'student') {
        console.log('[student resolver] userChatRooms query', queryShape);
        return;
    }
    log('query', { role, queryShape });
};

export const useMessengerRooms = ({ role = 'student', authUid = '', student = {}, parent = {} } = {}) => {
    const [rawRooms, setRawRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const participantKeys = useMemo(() => {
        if (role === 'parent') return buildParentParticipantKeys({ authUid, parent, student, studentId: student?.id || student?.studentId });
        if (role === 'staff') return uniqueStrings([authUid, parent?.id, student?.id, student?.studentId]);
        return buildStudentParticipantKeys({ authUid, student, studentId: student?.id || student?.studentId });
    }, [role, authUid, parent, student]);

    useEffect(() => {
        if (!authUid) {
            setRawRooms([]);
            setLoading(false);
            return undefined;
        }
        setLoading(true);
        setError('');
        const queryShape = getUserChatRoomsQueryShape(authUid);
        logChatRoomsQuery(role, authUid);
        const unsubscribe = subscribeUserChatRooms({
            authUid,
            onNext: (nextRooms) => {
                log('snapshot', { role, count: nextRooms.length });
                setRawRooms(nextRooms);
                setLoading(false);
                setError('');
            },
            onError: (snapshotError) => {
                console.error('[resolver] failed to load userChatRooms', {
                    role,
                    authUid,
                    queryShape,
                    code: snapshotError?.code,
                    message: snapshotError?.message,
                });
                setLoading(false);
                setError('대화 목록을 불러오지 못했습니다.');
            },
        });
        return unsubscribe;
    }, [role, authUid]);

    const resolved = useMemo(() => {
        if (role === 'parent') return resolveParentRooms({ rooms: rawRooms, participantKeys });
        if (role === 'staff') return { rooms: resolveStaffRooms({ rooms: rawRooms, participantKeys }) };
        return resolveStudentRooms({ rooms: rawRooms, authUid });
    }, [role, rawRooms, participantKeys, authUid]);

    return {
        rooms: sortRooms([...(resolved.rooms || rawRooms)]),
        rawRooms,
        loading,
        error,
        participantKeys,
        ...resolved,
    };
};
