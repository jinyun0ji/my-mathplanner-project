import React, { useEffect, useMemo, useState } from 'react';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import StudentMessenger from '../../components/StudentMessenger';
import { auth, db } from '../../firebase/client';

const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const uniqueStrings = (values) => Array.from(new Set(
    values.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
));

const roomDisplayName = (room) => {
    if (room?.teacherName) return String(room.teacherName);
    if (room?.staffName) return String(room.staffName);
    if (room?.name) return String(room.name);
    if (room?.title) return String(room.title);
    if (room?.displayName) return String(room.displayName);
    return '메시지';
};

const getRoomSortTime = (room) => (
    toDate(room?.updatedAt)?.getTime()
    || toDate(room?.lastMessageAt)?.getTime()
    || toDate(room?.createdAt)?.getTime()
    || 0
);

const getLastMessagePreview = (room) => (
    room?.lastMessageText
    || room?.lastMessage
    || room?.message
    || '대화 내역이 없습니다.'
);

const sortRooms = (roomList) => roomList.sort((a, b) => {
    if (a?.internalOnly === true && b?.internalOnly !== true) return -1;
    if (a?.internalOnly !== true && b?.internalOnly === true) return 1;
    return getRoomSortTime(b) - getRoomSortTime(a);
});

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
    if (studentId) addDescriptor('studentId', '==', String(studentId));

    return descriptors;
};

export default function ParentMessengerPage({ studentId, student, onBack }) {
    const [rooms, setRooms] = useState([]);
    const [error, setError] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState('');

    const authUid = String(auth.currentUser?.uid || '');
    const studentQueryFields = useMemo(() => ({
        parentId: student?.parentId || '',
        parentDocId: student?.parentDocId || '',
        parentUid: student?.parentUid || '',
    }), [student?.parentId, student?.parentDocId, student?.parentUid]);

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

            const descriptors = buildRoomQueries({ authUid, parentDocId, studentId, student: studentQueryFields });
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

    if (selectedRoomId) {
        return (
            <div className="h-screen min-h-screen bg-gray-50 flex flex-col overflow-hidden">
                <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
                    <button type="button" onClick={() => setSelectedRoomId('')} className="text-gray-700">
                        <ArrowBackIosNewIcon style={{ fontSize: 18 }} />
                    </button>
                    <h1 className="text-base font-semibold text-gray-900">메시지</h1>
                </header>
                <div className="flex-1 min-h-0">
                    <StudentMessenger
                        studentId={studentId}
                        studentAuthUid={student?.authUid || student?.studentUid || student?.uid || ''}
                        selectedRoomId={selectedRoomId}
                        userRole="parent"
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
                <h1 className="text-base font-semibold text-gray-900">메시지</h1>
            </header>
            <section className="py-2">
                {error && <div className="mx-4 mb-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2">{error}</div>}
                {rooms.length === 0 && !error && <div className="mx-4 mt-4 text-xs text-gray-500">아직 대화 내역이 없습니다.</div>}
                {rooms.map((room) => (
                    <button key={room.id} type="button" onClick={() => setSelectedRoomId(room.id)} className="h-16 w-full px-4 bg-white border-b border-gray-100 flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{roomDisplayName(room)}</p>
                            <p className="text-xs text-gray-500 truncate">{String(getLastMessagePreview(room))}</p>
                        </div>
                        <div className="text-[11px] text-gray-400">
                            {toDate(room?.lastMessageAt || room?.updatedAt || room?.createdAt)?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || ''}
                        </div>
                    </button>
                ))}
            </section>
        </div>
    );
}