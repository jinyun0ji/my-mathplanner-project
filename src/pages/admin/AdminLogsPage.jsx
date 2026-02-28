import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

import { db } from '../../firebase/client';
import { Icon } from '../../utils/helpers';

const formatLogTime = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value?.toDate === 'function') {
        try {
            return value.toDate().toISOString();
        } catch (error) {
            return '';
        }
    }
    return '';
};

export default function AdminLogsPage() {
    const [tab, setTab] = useState('error');
    const [scope, setScope] = useState('all');
    const [qText, setQText] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    const scopes = useMemo(() => ([
        'all', 'clinic', 'attendance', 'homework', 'grades', 'payment', 'lessons', 'announcements', 'auth',
    ]), []);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            try {
                const isError = tab === 'error';
                const colName = isError ? 'errorLogs' : 'auditLogs';

                const base = [];
                if (isError && scope !== 'all') base.push(where('scope', '==', scope));

                const sortField = isError ? 'createdAt' : 'at';
                const qy = query(
                    collection(db, colName),
                    ...base,
                    orderBy(sortField, 'desc'),
                    limit(200),
                );

                const snap = await getDocs(qy);
                const rows = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

                const filtered = qText.trim()
                    ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(qText.trim().toLowerCase()))
                    : rows;

                if (!cancelled) setItems(filtered);
            } catch (error) {
                console.error('[AdminLogsPage] load failed', error);
                if (!cancelled) setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [tab, scope, qText]);

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setTab('error')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'error' ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                            Error Logs
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('audit')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'audit' ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                            Audit Logs
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {tab === 'error' && (
                            <select
                                value={scope}
                                onChange={(event) => setScope(event.target.value)}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                            >
                                {scopes.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                        )}
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400">
                                <Icon name="search" className="w-4 h-4" />
                            </span>
                            <input
                                value={qText}
                                onChange={(event) => setQText(event.target.value)}
                                placeholder="검색(문자열 포함)"
                                className="pl-9 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 w-[260px]"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-3 text-xs text-gray-500">
                    {loading ? '로딩 중…' : `표시: ${items.length}건 (최대 200건 로드)`}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">시간</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">종류</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">요약</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">상세</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {items.map((it) => {
                                const time = tab === 'error' ? (it.createdAt || '') : formatLogTime(it.at);
                                const kind = tab === 'error'
                                    ? `${it.scope || 'unknown'} / ${it.action || ''}`
                                    : `${it.op || ''} / ${it?.target?.collection || ''}`;
                                const summary = tab === 'error'
                                    ? (it.message || '')
                                    : `${it?.target?.id || ''}`;
                                return (
                                    <tr key={it.id} className="hover:bg-indigo-50/30">
                                        <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">{time}</td>
                                        <td className="px-4 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">{kind}</td>
                                        <td className="px-4 py-3 text-sm text-gray-800">{summary}</td>
                                        <td className="px-4 py-3">
                                            <details className="text-xs text-gray-600">
                                                <summary className="cursor-pointer select-none">보기</summary>
                                                <pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(it, null, 2)}</pre>
                                            </details>
                                        </td>
                                    </tr>
                                );
                            })}
                            {items.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">데이터 없음</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}