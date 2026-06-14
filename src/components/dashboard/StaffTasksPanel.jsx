import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/client';
import { Modal } from '../common/Modal';

const CATEGORIES = { document: '문서', book: '교재', consultation: '상담', admin: '행정', etc: '기타' };
const STATUSES = { pending: '대기', in_progress: '진행 중', completed: '완료' };
const emptyForm = { title: '', content: '', category: 'etc', assigneeIds: '', assigneeNames: '', dueDate: '', status: 'pending' };
const ymd = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const toList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

export default function StaffTasksPanel({ actor }) {
    const [tasks, setTasks] = useState([]);
    const [filter, setFilter] = useState('today');
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(ymd(new Date()));
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const snapshot = await getDocs(query(collection(db, 'staffTasks'), orderBy('createdAt', 'desc')));
            setTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
            setError('');
        } catch (loadError) {
            console.error('[staffTasks] load failed', loadError);
            setError('업무 목록을 불러오지 못했습니다.');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId('');
        setForm(emptyForm);
    };
    const openCreate = () => {
        setEditingId('');
        setForm({ ...emptyForm, assigneeIds: actor.uid || '', assigneeNames: actor.name || '' });
        setIsModalOpen(true);
    };
    const openEdit = (task) => {
        setEditingId(task.id);
        setForm({
            title: task.title || '', content: task.content || '', category: task.category || 'etc',
            assigneeIds: (task.assigneeIds || []).join(', '), assigneeNames: (task.assigneeNames || []).join(', '),
            status: task.status || 'pending', dueDate: task.dueDate || '',
        });
        setIsModalOpen(true);
    };

    const save = async (event) => {
        event.preventDefault();
        if (!form.title.trim() || saving) return;
        setSaving(true);
        try {
            const assigneeIds = toList(form.assigneeIds);
            const assigneeNames = toList(form.assigneeNames);
            const base = {
                title: form.title.trim(), content: form.content.trim(), category: form.category,
                assigneeIds, assigneeNames, dueDate: form.dueDate, status: form.status,
                updatedAt: serverTimestamp(), updatedBy: actor.uid,
                completedAt: form.status === 'completed' ? serverTimestamp() : null,
                completedBy: form.status === 'completed' ? actor.uid : '',
                completedByName: form.status === 'completed' ? actor.name : '',
            };
            if (editingId) await updateDoc(doc(db, 'staffTasks', editingId), base);
            else await addDoc(collection(db, 'staffTasks'), {
                ...base, createdAt: serverTimestamp(), createdBy: actor.uid, createdByName: actor.name,
            });
            closeModal();
            await load();
        } catch (saveError) {
            console.error('[staffTasks] save failed', saveError);
            setError('업무를 저장하지 못했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const complete = async (task) => {
        await updateDoc(doc(db, 'staffTasks', task.id), {
            status: 'completed', completedAt: serverTimestamp(), completedBy: actor.uid,
            completedByName: actor.name, updatedAt: serverTimestamp(), updatedBy: actor.uid,
        });
        await load();
    };
    const remove = async (task) => {
        if (!window.confirm(`"${task.title}" 업무를 삭제할까요?`)) return;
        await deleteDoc(doc(db, 'staffTasks', task.id));
        if (editingId === task.id) closeModal();
        await load();
    };

    const today = ymd(new Date());
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + (7 - ((weekEnd.getDay() + 6) % 7) - 1));
    const filtered = tasks.filter((task) => {
        if (filter === 'completed') return task.status === 'completed';
        if (task.status === 'completed') return false;
        if (filter === 'today') return task.dueDate === today;
        if (filter === 'week') return task.dueDate >= today && task.dueDate <= ymd(weekEnd);
        return true;
    });
    const days = useMemo(() => {
        const first = new Date(month.getFullYear(), month.getMonth(), 1);
        const start = new Date(first); start.setDate(start.getDate() - start.getDay());
        return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
    }, [month]);
    const selectedTasks = tasks.filter((task) => task.dueDate === selectedDate);

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-lg font-bold text-gray-900">직원 업무관리</h3><p className="text-xs text-gray-500">staffTasks · 일반 업무와 마감일 관리</p></div>
                <button type="button" onClick={openCreate} className="rounded-xl bg-[#455fab] px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-[#3b5198]">+ 업무 추가</button>
            </div>
            {error && <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
                <div>
                    <div className="mb-3 flex rounded-lg bg-gray-100 p-1">
                        {[['today', '오늘 마감'], ['week', '이번 주'], ['all', '진행 업무'], ['completed', '완료 업무']].map(([value, label]) => (
                            <button key={value} type="button" onClick={() => setFilter(value)} className={`flex-1 rounded-md px-2 py-2 text-xs font-bold ${filter === value ? 'bg-white text-[#334a91] shadow-sm' : 'text-gray-500'}`}>{label}</button>
                        ))}
                    </div>
                    <div className="max-h-80 space-y-2 overflow-auto">
                        {filtered.map((task) => (
                            <div key={task.id} className="flex items-start gap-2 rounded-lg border p-3">
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-bold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</p>
                                    <p className="text-xs text-gray-500">{CATEGORIES[task.category] || '기타'} · {STATUSES[task.status] || '대기'} · {task.dueDate || '마감일 없음'}</p>
                                    {task.assigneeNames?.length > 0 && <p className="mt-1 text-xs text-gray-400">담당: {task.assigneeNames.join(', ')}</p>}
                                </div>
                                {task.status !== 'completed' && <button type="button" onClick={() => complete(task)} className="text-xs font-semibold text-emerald-700">완료</button>}
                                <button type="button" onClick={() => openEdit(task)} className="text-xs text-[#455fab]">수정</button>
                                <button type="button" onClick={() => remove(task)} className="text-xs text-rose-600">삭제</button>
                            </div>
                        ))}
                        {filtered.length === 0 && <p className="py-6 text-center text-sm text-gray-400">해당 업무가 없습니다.</p>}
                    </div>
                </div>
                <div>
                    <div className="mb-2 flex items-center justify-between"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong className="text-sm">{month.getFullYear()}년 {month.getMonth() + 1}월</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
                    <div className="grid grid-cols-7 overflow-hidden rounded-lg border text-center text-xs">
                        {'일월화수목금토'.split('').map((day) => <div key={day} className="bg-gray-50 py-2 font-bold">{day}</div>)}
                        {days.map((date) => { const dateKey = ymd(date); const count = tasks.filter((task) => task.dueDate === dateKey).length; return <button type="button" key={dateKey} onClick={() => setSelectedDate(dateKey)} className={`min-h-12 border-t p-1 ${date.getMonth() !== month.getMonth() ? 'text-gray-300' : ''} ${selectedDate === dateKey ? 'bg-[#f1f4ff]' : ''}`}><span>{date.getDate()}</span>{count > 0 && <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-[#455fab]" />}</button>; })}
                    </div>
                    <div className="mt-3 rounded-lg bg-gray-50 p-3"><p className="mb-2 text-xs font-bold">{selectedDate} 업무</p>{selectedTasks.map((task) => <button type="button" onClick={() => openEdit(task)} key={task.id} className="block text-left text-xs text-gray-600 hover:text-[#455fab]">• {task.title}</button>)}{selectedTasks.length === 0 && <p className="text-xs text-gray-400">등록된 업무가 없습니다.</p>}</div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? '업무 수정' : '업무 추가'} maxWidth="max-w-2xl">
                <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2 text-sm font-semibold text-gray-700">제목<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
                    <label className="sm:col-span-2 text-sm font-semibold text-gray-700">내용<textarea rows="5" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
                    <label className="text-sm font-semibold text-gray-700">카테고리<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="text-sm font-semibold text-gray-700">상태<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{Object.entries(STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="text-sm font-semibold text-gray-700">담당자 ID<input value={form.assigneeIds} onChange={(e) => setForm({ ...form, assigneeIds: e.target.value })} placeholder="여러 명은 쉼표로 구분" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
                    <label className="text-sm font-semibold text-gray-700">담당자 이름<input value={form.assigneeNames} onChange={(e) => setForm({ ...form, assigneeNames: e.target.value })} placeholder="여러 명은 쉼표로 구분" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
                    <label className="text-sm font-semibold text-gray-700">마감일<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
                    <div className="flex items-end justify-end gap-2 sm:col-span-2"><button type="button" onClick={closeModal} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-600">취소</button><button disabled={saving} className="rounded-lg bg-[#455fab] px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? '저장 중...' : editingId ? '수정 저장' : '업무 추가'}</button></div>
                </form>
            </Modal>
        </section>
    );
}
