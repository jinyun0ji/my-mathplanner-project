import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/client';

const CATEGORIES = { document: '문서', book: '교재', consultation: '상담', admin: '행정', etc: '기타' };
const emptyForm = { title: '', content: '', category: 'etc', status: 'pending', dueDate: '' };
const ymd = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export default function StaffTasksPanel({ actor }) {
    const [tasks, setTasks] = useState([]);
    const [filter, setFilter] = useState('today');
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState('');
    const [selectedDate, setSelectedDate] = useState(ymd(new Date()));
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [error, setError] = useState('');

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

    const save = async (event) => {
        event.preventDefault();
        if (!form.title.trim()) return;
        const base = {
            ...form,
            title: form.title.trim(),
            content: form.content.trim(),
            assigneeIds: actor.uid ? [actor.uid] : [],
            assigneeNames: actor.name ? [actor.name] : [],
            updatedAt: serverTimestamp(),
            updatedBy: actor.uid,
        };
        if (editingId) {
            await updateDoc(doc(db, 'staffTasks', editingId), base);
        } else {
            await addDoc(collection(db, 'staffTasks'), {
                ...base,
                createdAt: serverTimestamp(),
                createdBy: actor.uid,
                createdByName: actor.name,
                completedAt: null,
                completedBy: '',
                completedByName: '',
            });
        }
        setForm(emptyForm);
        setEditingId('');
        await load();
    };

    const complete = async (task) => {
        const completed = task.status !== 'completed';
        await updateDoc(doc(db, 'staffTasks', task.id), {
            status: completed ? 'completed' : 'pending',
            completedAt: completed ? serverTimestamp() : null,
            completedBy: completed ? actor.uid : '',
            completedByName: completed ? actor.name : '',
            updatedAt: serverTimestamp(),
            updatedBy: actor.uid,
        });
        await load();
    };

    const remove = async (task) => {
        if (!window.confirm(`"${task.title}" 업무를 삭제할까요?`)) return;
        await deleteDoc(doc(db, 'staffTasks', task.id));
        await load();
    };

    const today = ymd(new Date());
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + (7 - ((weekEnd.getDay() + 6) % 7) - 1));
    const filtered = tasks.filter((task) => {
        if (filter === 'today') return task.dueDate === today;
        if (filter === 'week') return task.dueDate >= today && task.dueDate <= ymd(weekEnd);
        return true;
    });
    const days = useMemo(() => {
        const first = new Date(month.getFullYear(), month.getMonth(), 1);
        const start = new Date(first);
        start.setDate(start.getDate() - start.getDay());
        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(start);
            date.setDate(start.getDate() + index);
            return date;
        });
    }, [month]);
    const selectedTasks = tasks.filter((task) => task.dueDate === selectedDate);

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">직원 업무관리</h3>
                <p className="text-xs text-gray-500">staffTasks · 일반 업무와 마감일 관리</p>
            </div>
            {error && <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <form onSubmit={save} className="mb-5 grid gap-2 rounded-xl bg-gray-50 p-3 md:grid-cols-6">
                <input className="rounded-lg border px-3 py-2 text-sm md:col-span-2" placeholder="업무 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <select className="rounded-lg border px-2 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input type="date" className="rounded-lg border px-2 py-2 text-sm" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                <input className="rounded-lg border px-3 py-2 text-sm" placeholder="내용" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                <button className="rounded-lg bg-[#455fab] px-3 py-2 text-sm font-bold text-white">{editingId ? '수정 저장' : '업무 추가'}</button>
            </form>
            <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
                <div>
                    <div className="mb-3 flex rounded-lg bg-gray-100 p-1">
                        {[['today', '오늘 마감'], ['week', '이번 주'], ['all', '전체']].map(([value, label]) => (
                            <button key={value} type="button" onClick={() => setFilter(value)} className={`flex-1 rounded-md px-2 py-2 text-xs font-bold ${filter === value ? 'bg-white text-[#334a91] shadow-sm' : 'text-gray-500'}`}>{label}</button>
                        ))}
                    </div>
                    <div className="max-h-80 space-y-2 overflow-auto">
                        {filtered.map((task) => (
                            <div key={task.id} className="flex items-start gap-2 rounded-lg border p-3">
                                <input type="checkbox" checked={task.status === 'completed'} onChange={() => complete(task)} className="mt-1" />
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-bold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</p>
                                    <p className="text-xs text-gray-500">{CATEGORIES[task.category] || '기타'} · {task.dueDate || '마감일 없음'}</p>
                                </div>
                                <button type="button" onClick={() => { setEditingId(task.id); setForm({ title: task.title || '', content: task.content || '', category: task.category || 'etc', status: task.status || 'pending', dueDate: task.dueDate || '' }); }} className="text-xs text-[#455fab]">수정</button>
                                <button type="button" onClick={() => remove(task)} className="text-xs text-rose-600">삭제</button>
                            </div>
                        ))}
                        {filtered.length === 0 && <p className="py-6 text-center text-sm text-gray-400">해당 업무가 없습니다.</p>}
                    </div>
                </div>
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
                        <strong className="text-sm">{month.getFullYear()}년 {month.getMonth() + 1}월</strong>
                        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
                    </div>
                    <div className="grid grid-cols-7 overflow-hidden rounded-lg border text-center text-xs">
                        {'일월화수목금토'.split('').map((day) => <div key={day} className="bg-gray-50 py-2 font-bold">{day}</div>)}
                        {days.map((date) => {
                            const dateKey = ymd(date);
                            const count = tasks.filter((task) => task.dueDate === dateKey).length;
                            return <button type="button" key={dateKey} onClick={() => setSelectedDate(dateKey)} className={`min-h-12 border-t p-1 ${date.getMonth() !== month.getMonth() ? 'text-gray-300' : ''} ${selectedDate === dateKey ? 'bg-[#f1f4ff]' : ''}`}>
                                <span>{date.getDate()}</span>{count > 0 && <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-[#455fab]" />}
                            </button>;
                        })}
                    </div>
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                        <p className="mb-2 text-xs font-bold">{selectedDate} 업무</p>
                        {selectedTasks.map((task) => <p key={task.id} className="text-xs text-gray-600">• {task.title}</p>)}
                        {selectedTasks.length === 0 && <p className="text-xs text-gray-400">등록된 업무가 없습니다.</p>}
                    </div>
                </div>
            </div>
        </section>
    );
}
