import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import {
    completeStaffTimelineThread,
    createStaffTimelineReply,
    createStaffTimelineThread,
    fetchStaffTimeline,
    fetchStaffTimelineReplies,
    softDeleteStaffTimelineReply,
    softDeleteStaffTimelineThread,
    updateStaffTimelineReply,
    updateStaffTimelineThread,
} from './staffTimeline.service';

jest.mock('firebase/firestore', () => ({
    addDoc: jest.fn(),
    collection: jest.fn((...args) => ({ type: 'collection', args })),
    doc: jest.fn((...args) => ({ type: 'doc', args })),
    getDocs: jest.fn(),
    limit: jest.fn((value) => ({ type: 'limit', value })),
    orderBy: jest.fn((field, direction) => ({ type: 'orderBy', field, direction })),
    query: jest.fn((...args) => ({ type: 'query', args })),
    runTransaction: jest.fn(),
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    updateDoc: jest.fn(),
    where: jest.fn((field, operator, value) => ({ type: 'where', field, operator, value })),
}));

const db = { name: 'db' };
const makeSnapshot = (items) => ({
    docs: items.map(({ id, ...data }) => ({ id, data: () => data })),
});

describe('staffTimeline.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        collection.mockImplementation((...args) => ({ type: 'collection', args }));
        doc.mockImplementation((...args) => ({ type: 'doc', args }));
        limit.mockImplementation((value) => ({ type: 'limit', value }));
        orderBy.mockImplementation((field, direction) => ({ type: 'orderBy', field, direction }));
        query.mockImplementation((...args) => ({ type: 'query', args }));
        serverTimestamp.mockReturnValue('SERVER_TIMESTAMP');
        where.mockImplementation((field, operator, value) => ({ type: 'where', field, operator, value }));
        addDoc.mockResolvedValue({ id: 'new-thread' });
        updateDoc.mockResolvedValue(undefined);
    });

    test('상태 필터 조회 시 soft delete root를 숨긴다', async () => {
        getDocs.mockResolvedValue(makeSnapshot([
            { id: 'visible', status: 'completed', isDeleted: false },
            { id: 'deleted', status: 'completed', isDeleted: true },
        ]));

        const result = await fetchStaffTimeline(db, { status: 'completed', limitCount: 25 });

        expect(where).toHaveBeenCalledWith('status', '==', 'completed');
        expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
        expect(limit).toHaveBeenCalledWith(25);
        expect(result).toEqual([{ id: 'visible', status: 'completed', isDeleted: false }]);
    });

    test('all 조회는 status where 없이 최신순으로 조회한다', async () => {
        getDocs.mockResolvedValue(makeSnapshot([]));

        await fetchStaffTimeline(db, { status: 'all', limitCount: 50 });

        expect(where).not.toHaveBeenCalledWith('status', '==', expect.anything());
        expect(query).toHaveBeenCalled();
    });

    test('클리닉 sourceSummary와 thread 기본 메타데이터를 복사 저장한다', async () => {
        await createStaffTimelineThread(db, {
            sourceDocId: 'clinic-1',
            sourceCollection: 'clinicReservations',
            sourceSummary: {
                date: '2026-06-05',
                plannedTime: '18:00',
                teacherName: '채수용T',
                clinicComment: '오답 재확인',
                status: 'attended',
            },
            studentId: 'student-1',
            studentName: '박수빈',
            content: '다음 시간 확인',
            createdBy: 'staff-1',
            createdByName: '담당자',
            senderRole: 'staff',
        });

        expect(addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            sourceType: 'clinic',
            sourceDocId: 'clinic-1',
            sourceCollection: 'clinicReservations',
            sourceSummary: {
                date: '2026-06-05',
                plannedTime: '18:00',
                teacherName: '채수용T',
                clinicComment: '오답 재확인',
                status: 'attended',
            },
            status: 'pending',
            replyCount: 0,
            isDeleted: false,
        }));
    });

    test('root 수정, soft delete, 완료 처리를 update로 저장한다', async () => {
        await updateStaffTimelineThread(db, 'thread-1', { content: '수정 내용', updatedBy: 'staff-1' });
        expect(updateDoc).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
            content: '수정 내용',
            updatedBy: 'staff-1',
        }));

        await softDeleteStaffTimelineThread(db, 'thread-1', { uid: 'staff-1' });
        expect(updateDoc).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
            isDeleted: true,
            deletedBy: 'staff-1',
        }));

        await completeStaffTimelineThread(db, 'thread-1', { uid: 'staff-1', name: '담당자' }, '완료했습니다');
        expect(updateDoc).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
            status: 'completed',
            completedBy: 'staff-1',
            completedByName: '담당자',
            completionComment: '완료했습니다',
        }));
    });

    test('댓글 생성은 transaction에서 replyCount와 마지막 댓글 정보를 갱신한다', async () => {
        const transaction = {
            get: jest.fn().mockResolvedValue({ exists: () => true, data: () => ({ replyCount: 2 }) }),
            set: jest.fn(),
            update: jest.fn(),
        };
        runTransaction.mockImplementation(async (_db, callback) => callback(transaction));

        await createStaffTimelineReply(db, 'thread-1', {
            content: '추가 확인 예정',
            createdBy: 'staff-1',
            createdByName: '담당자',
            senderRole: 'teacher',
        });

        expect(transaction.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            content: '추가 확인 예정',
            isDeleted: false,
        }));
        expect(transaction.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            replyCount: 3,
            lastReplyByName: '담당자',
        }));
    });

    test('댓글 수정과 soft delete를 지원하고 삭제 댓글 문구를 유지한다', async () => {
        await updateStaffTimelineReply(db, 'thread-1', 'reply-1', { content: '수정 댓글', updatedBy: 'staff-1' });
        expect(updateDoc).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
            content: '수정 댓글',
            updatedBy: 'staff-1',
        }));

        const transaction = {
            get: jest.fn()
                .mockResolvedValueOnce({ exists: () => true, data: () => ({ replyCount: 1 }) })
                .mockResolvedValueOnce({ exists: () => true, data: () => ({ isDeleted: false }) }),
            update: jest.fn(),
        };
        runTransaction.mockImplementation(async (_db, callback) => callback(transaction));
        await softDeleteStaffTimelineReply(db, 'thread-1', 'reply-1', { uid: 'staff-1' });
        expect(transaction.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            isDeleted: true,
            content: '삭제된 메모입니다.',
            deletedBy: 'staff-1',
        }));
        expect(transaction.update).toHaveBeenCalledWith(expect.anything(), { replyCount: 0 });

        getDocs.mockResolvedValue(makeSnapshot([
            { id: 'reply-1', content: '원문', isDeleted: true },
        ]));
        await expect(fetchStaffTimelineReplies(db, 'thread-1')).resolves.toEqual([
            { id: 'reply-1', content: '삭제된 메모입니다.', isDeleted: true },
        ]);
    });

    test('필수 식별자가 없으면 mutation을 거부한다', async () => {
        await expect(updateStaffTimelineThread(db, '', { content: 'x' })).rejects.toThrow('교직원 메모 ID가 없습니다.');
        expect(serverTimestamp).not.toHaveBeenCalled();
        expect(doc).not.toHaveBeenCalled();
        expect(collection).not.toHaveBeenCalled();
    });
});
