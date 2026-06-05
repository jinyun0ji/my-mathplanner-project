import React, { useState } from 'react';
import { db } from '../../firebase/client';
import {
    completeStaffTimelineThread,
    createStaffTimelineReply,
    fetchStaffTimelineReplies,
    softDeleteStaffTimelineReply,
    softDeleteStaffTimelineThread,
    updateStaffTimelineReply,
    updateStaffTimelineThread,
} from '../../domain/staffTimeline/staffTimeline.service';

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const compactText = (value, maxLength = 120) => {
    const text = String(value || '').trim();
    if (!text) return '원문 코멘트 없음';
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
};

export default function StaffTimelineThreadCard({
    thread,
    actor,
    onChanged,
    showStudentName = true,
    compact = false,
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [replies, setReplies] = useState([]);
    const [replyDraft, setReplyDraft] = useState('');
    const [loadingReplies, setLoadingReplies] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editingRoot, setEditingRoot] = useState(false);
    const [rootDraft, setRootDraft] = useState(thread.content || '');
    const [editingReplyId, setEditingReplyId] = useState('');
    const [replyEditDraft, setReplyEditDraft] = useState('');

    const isCompleted = thread.status === 'completed';
    const summary = thread.sourceSummary || {};
    const clinicWhen = [summary.date, summary.plannedTime].filter(Boolean).join(' ') || '일시 미상';

    const reloadReplies = async () => {
        setLoadingReplies(true);
        setError('');
        try {
            setReplies(await fetchStaffTimelineReplies(db, thread.id));
        } catch (loadError) {
            console.error('[staffTimeline] failed to load replies', loadError);
            setError('댓글을 불러오지 못했습니다.');
        } finally {
            setLoadingReplies(false);
        }
    };

    const toggleReplies = async () => {
        const nextExpanded = !isExpanded;
        setIsExpanded(nextExpanded);
        if (nextExpanded) await reloadReplies();
    };

    const runMutation = async (mutation, fallbackMessage, { refreshReplies = false } = {}) => {
        setSaving(true);
        setError('');
        try {
            await mutation();
            if (refreshReplies) await reloadReplies();
            await onChanged?.();
            return true;
        } catch (mutationError) {
            console.error('[staffTimeline] mutation failed', mutationError);
            setError(mutationError?.message || fallbackMessage);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateRoot = async () => {
        const content = rootDraft.trim();
        if (!content) {
            setError('메모 내용을 입력하세요.');
            return;
        }
        const didSave = await runMutation(
            () => updateStaffTimelineThread(db, thread.id, { content, updatedBy: actor.uid }),
            '메모 수정에 실패했습니다.',
        );
        if (didSave) setEditingRoot(false);
    };

    const handleDeleteRoot = async () => {
        if (!window.confirm('이 교직원 메모를 삭제하시겠습니까?')) return;
        await runMutation(
            () => softDeleteStaffTimelineThread(db, thread.id, actor),
            '메모 삭제에 실패했습니다.',
        );
    };

    const handleComplete = async () => {
        const completionComment = window.prompt('처리 완료 메모를 입력하세요. (선택)') || '';
        await runMutation(
            () => completeStaffTimelineThread(db, thread.id, actor, completionComment),
            '완료 처리에 실패했습니다.',
        );
    };

    const handleCreateReply = async () => {
        const content = replyDraft.trim();
        if (!content) {
            setError('댓글 내용을 입력하세요.');
            return;
        }
        const didSave = await runMutation(
            () => createStaffTimelineReply(db, thread.id, {
                content,
                createdBy: actor.uid,
                createdByName: actor.name,
                senderRole: actor.role,
            }),
            '댓글 저장에 실패했습니다.',
            { refreshReplies: true },
        );
        if (didSave) setReplyDraft('');
    };

    const handleUpdateReply = async (replyId) => {
        const content = replyEditDraft.trim();
        if (!content) {
            setError('댓글 내용을 입력하세요.');
            return;
        }
        const didSave = await runMutation(
            () => updateStaffTimelineReply(db, thread.id, replyId, { content, updatedBy: actor.uid }),
            '댓글 수정에 실패했습니다.',
            { refreshReplies: true },
        );
        if (didSave) {
            setEditingReplyId('');
            setReplyEditDraft('');
        }
    };

    const handleDeleteReply = async (replyId) => {
        if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;
        await runMutation(
            () => softDeleteStaffTimelineReply(db, thread.id, replyId, actor),
            '댓글 삭제에 실패했습니다.',
            { refreshReplies: true },
        );
    };

    return (
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    {showStudentName && <p className="text-base font-bold text-gray-900">{thread.studentName || '학생명 미상'}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span className="rounded bg-[#eef2ff] px-2 py-0.5 font-bold text-[#334a91]">
                            {thread.sourceType === 'clinic' ? '클리닉' : thread.sourceType || '기타'}
                        </span>
                        <span>{clinicWhen}</span>
                        {summary.teacherName && <span>· {summary.teacherName}</span>}
                    </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${isCompleted ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-[#dfe6ff] bg-[#eef2ff] text-[#334a91]'}`}>
                    {isCompleted ? '처리완료' : '처리대기'}
                </span>
            </div>

            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">클리닉 원문</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">{compactText(summary.clinicComment, compact ? 80 : 160)}</p>
            </div>

            {editingRoot ? (
                <div className="mt-3">
                    <textarea
                        value={rootDraft}
                        onChange={(event) => setRootDraft(event.target.value)}
                        className="min-h-[90px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#455fab] focus:outline-none focus:ring-2 focus:ring-[#dfe6ff]"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={() => { setEditingRoot(false); setRootDraft(thread.content || ''); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600">취소</button>
                        <button type="button" disabled={saving} onClick={handleUpdateRoot} className="rounded-lg bg-[#455fab] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">저장</button>
                    </div>
                </div>
            ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{thread.content || '내용 없음'}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
                <span>{thread.createdByName || '-'} · {formatDateTime(thread.createdAt)}{thread.updatedAt ? ' · 수정됨' : ''}</span>
                <span className="font-semibold text-gray-600">댓글 {Number(thread.replyCount || 0)}개</span>
            </div>

            {isCompleted && (thread.completedByName || thread.completionComment) && (
                <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    완료: {thread.completedByName || '-'}{thread.completionComment ? ` · ${thread.completionComment}` : ''}
                </div>
            )}

            {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={toggleReplies} className="rounded-lg border border-[#dfe6ff] bg-[#f8f9ff] px-3 py-1.5 text-xs font-bold text-[#334a91]">
                    {isExpanded ? '댓글 닫기' : '댓글 보기'}
                </button>
                <button type="button" onClick={() => setEditingRoot(true)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600">메모 수정</button>
                <button type="button" onClick={handleDeleteRoot} disabled={saving} className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50">메모 삭제</button>
                {!isCompleted && (
                    <button type="button" onClick={handleComplete} disabled={saving} className="ml-auto rounded-lg bg-[#455fab] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">처리 완료</button>
                )}
            </div>

            {isExpanded && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    {loadingReplies ? (
                        <p className="text-center text-xs text-gray-500">댓글을 불러오는 중입니다...</p>
                    ) : replies.length === 0 ? (
                        <p className="text-center text-xs text-gray-400">아직 댓글이 없습니다.</p>
                    ) : replies.map((reply) => (
                        <div key={reply.id} className={`rounded-lg border px-3 py-2 ${reply.isDeleted ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-gray-50/70'}`}>
                            {editingReplyId === reply.id ? (
                                <>
                                    <textarea value={replyEditDraft} onChange={(event) => setReplyEditDraft(event.target.value)} className="min-h-[70px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
                                    <div className="mt-2 flex justify-end gap-2">
                                        <button type="button" onClick={() => setEditingReplyId('')} className="text-xs font-semibold text-gray-500">취소</button>
                                        <button type="button" onClick={() => handleUpdateReply(reply.id)} className="rounded bg-[#455fab] px-2.5 py-1 text-xs font-bold text-white">저장</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className={`whitespace-pre-wrap text-sm ${reply.isDeleted ? 'italic text-gray-400' : 'text-gray-700'}`}>{reply.content}</p>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
                                        <span>{reply.createdByName || '-'} · {formatDateTime(reply.createdAt)}{reply.updatedAt ? ' · 수정됨' : ''}</span>
                                        {!reply.isDeleted && (
                                            <span className="flex gap-2">
                                                <button type="button" onClick={() => { setEditingReplyId(reply.id); setReplyEditDraft(reply.content || ''); }} className="font-semibold text-gray-500">수정</button>
                                                <button type="button" onClick={() => handleDeleteReply(reply.id)} className="font-semibold text-rose-500">삭제</button>
                                            </span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    <div className="rounded-lg border border-[#dfe6ff] bg-[#f8f9ff] p-3">
                        <textarea
                            value={replyDraft}
                            onChange={(event) => setReplyDraft(event.target.value)}
                            placeholder={isCompleted ? '완료 후 추가 확인사항도 댓글로 남길 수 있습니다.' : '댓글을 입력하세요.'}
                            className="min-h-[76px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#455fab] focus:outline-none"
                        />
                        <div className="mt-2 flex justify-end">
                            <button type="button" onClick={handleCreateReply} disabled={saving} className="rounded-lg bg-[#455fab] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">댓글 등록</button>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
}
