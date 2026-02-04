import React, { useMemo, useState } from 'react';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { Icon, toDateStr } from '../utils/helpers';

const defaultForm = {
    startDate: '',
    endDate: '',
    scope: 'global',
    classId: '',
    title: '휴강',
    reason: '',
};

export default function ClosureManagement({ closures = [], setClosures, classes = [] }) {
    const [form, setForm] = useState(defaultForm);
    const [editingId, setEditingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const classMap = useMemo(() => {
        const map = new Map();
        classes.forEach((cls) => {
            if (cls?.id) map.set(String(cls.id), cls.name || cls.title || cls.className || '');
        });
        return map;
    }, [classes]);

    const sortedClosures = useMemo(() => {
        return [...(closures || [])].sort((a, b) => {
            const ad = String(toDateStr(a.startDate) || '');
            const bd = String(toDateStr(b.startDate) || '');
            return bd.localeCompare(ad);
        });
    }, [closures]);

    const resetForm = () => {
        setForm(defaultForm);
        setEditingId(null);
    };

    const handleEdit = (closure) => {
        setEditingId(closure.id);
        setForm({
            startDate: toDateStr(closure.startDate),
            endDate: toDateStr(closure.endDate),
            scope: closure.scope || 'global',
            classId: closure.classId || '',
            title: closure.title || '휴강',
            reason: closure.reason || '',
        });
    };

    const handleDelete = async (closure) => {
        if (!closure?.id) return;
        if (!window.confirm('해당 휴강 기간을 삭제할까요?')) return;
        await deleteDoc(doc(db, 'closures', closure.id));
        setClosures?.((prev) => prev.filter((item) => item.id !== closure.id));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.startDate || !form.endDate) {
            alert('시작일과 종료일을 입력해주세요.');
            return;
        }
        if (form.startDate > form.endDate) {
            alert('종료일은 시작일 이후여야 합니다.');
            return;
        }
        if (form.scope === 'class' && !form.classId) {
            alert('반을 선택해주세요.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                startDate: form.startDate,
                endDate: form.endDate,
                scope: form.scope,
                classId: form.scope === 'class' ? form.classId : null,
                title: form.title || '휴강',
                reason: form.reason || '',
                updatedAt: serverTimestamp(),
            };

            if (editingId) {
                await updateDoc(doc(db, 'closures', editingId), payload);
                setClosures?.((prev) => prev.map((item) => (
                    item.id === editingId
                        ? { ...item, ...payload, classId: payload.classId }
                        : item
                )));
            } else {
                const docRef = await addDoc(collection(db, 'closures'), {
                    ...payload,
                    createdAt: serverTimestamp(),
                });
                setClosures?.((prev) => [
                    { id: docRef.id, ...payload, createdAt: new Date() },
                    ...prev,
                ]);
            }

            resetForm();
        } catch (error) {
            console.error('휴강 저장 실패', error);
            alert('휴강 정보를 저장하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">휴강 관리</h1>
                    <p className="text-sm text-gray-500">휴강 기간을 등록/수정/삭제하고 일정에 반영합니다.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-gray-700">
                        시작일
                        <input
                            type="date"
                            value={form.startDate}
                            onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                        />
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                        종료일
                        <input
                            type="date"
                            value={form.endDate}
                            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                        />
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-gray-700">
                        범위
                        <select
                            value={form.scope}
                            onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                        >
                            <option value="global">전체</option>
                            <option value="class">반별</option>
                        </select>
                    </label>

                    <label className="text-sm font-medium text-gray-700">
                        반 선택
                        <select
                            value={form.classId}
                            onChange={(e) => setForm((prev) => ({ ...prev, classId: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                            disabled={form.scope !== 'class'}
                        >
                            <option value="">반 선택</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-gray-700">
                        제목
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                        />
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                        사유 (선택)
                        <input
                            type="text"
                            value={form.reason}
                            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                        />
                    </label>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        <Icon name="check" className="w-4 h-4" />
                        {editingId ? '휴강 수정' : '휴강 등록'}
                    </button>
                    {editingId && (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                        >
                            취소
                        </button>
                    )}
                </div>
            </form>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">등록된 휴강</h2>
                {sortedClosures.length === 0 ? (
                    <div className="text-sm text-gray-500">등록된 휴강이 없습니다.</div>
                ) : (
                    <div className="space-y-3">
                        {sortedClosures.map((closure) => {
                            const start = toDateStr(closure.startDate);
                            const end = toDateStr(closure.endDate);
                            const scopeLabel = closure.scope === 'class'
                                ? `반별 (${classMap.get(String(closure.classId)) || closure.classId || '반'})`
                                : '전체';
                            return (
                                <div key={closure.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{closure.title || '휴강'}</p>
                                        <p className="text-sm text-gray-500">
                                            {start} ~ {end} · {scopeLabel}
                                        </p>
                                        {closure.reason && (
                                            <p className="text-xs text-gray-400">사유: {closure.reason}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(closure)}
                                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                        >
                                            수정
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(closure)}
                                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}