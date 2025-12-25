import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/client';

const formatSentAt = (sentAt) => {
    if (!sentAt) return '-';
    if (sentAt.toDate) return sentAt.toDate().toLocaleString('ko-KR');
    if (sentAt instanceof Date) return sentAt.toLocaleString('ko-KR');
    return '-';
};

export default function AdminNotificationsPage() {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        const fetchLogs = async () => {
            if (!db) {
                setLogs([]);
                return;
            }

            setIsLoading(true);
            setError('');

            try {
                console.info('[AdminNotificationsPage] Firestore path: notifications');
                const snapshot = await getDocs(query(
                    collection(db, 'notifications'),
                    orderBy('sentAt', 'desc'),
                    limit(20),
                ));
                if (!isMounted) return;
                setLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            } catch (fetchError) {
                if (!isMounted) return;
                setError(fetchError?.message || '알림 로그를 불러오지 못했습니다.');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchLogs();

        return () => {
            isMounted = false;
        };
    }, []);
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">관리자 전용</p>
                    <h1 className="text-2xl font-bold text-gray-800">알림 로그</h1>
                    <p className="text-sm text-gray-500">
                        최근 20건의 발송 내역만 불러와 Firestore 읽기 비용을 최소화합니다.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">발송 기록</h2>
                        <p className="text-sm text-gray-500">
                            알림 발송이 완료되면 이 목록에 저장됩니다. 대상 수와 실패 수를 바로 확인하세요.
                        </p>
                    </div>
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100">
                        최신 20건
                    </span>
                </div>

                {isLoading && (
                    <div className="mt-6 text-sm text-gray-500">알림 로그를 불러오는 중...</div>
                )}
                {error && (
                    <div className="mt-6 text-sm text-red-500">{error}</div>
                )}

                {!isLoading && !error && logs.length === 0 && (
                    <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                        <p className="text-sm font-semibold text-gray-700">아직 발송된 알림이 없습니다</p>
                        <p className="text-xs text-gray-500 mt-2">
                            새로운 알림을 발송하면 발송 시각과 대상 수가 이곳에 기록됩니다.
                        </p>
                    </div>
                )}

                {!isLoading && !error && logs.length > 0 && (
                    <div className="mt-6 overflow-x-auto border border-gray-200 rounded-xl">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">제목</th>
                                    <th className="px-4 py-3 text-left font-semibold">발송 시각</th>
                                    <th className="px-4 py-3 text-right font-semibold">대상 수</th>
                                    <th className="px-4 py-3 text-right font-semibold">실패 수</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => {
                                    const targetCount = log.targetCount ?? log.targetUserCount ?? 0;
                                    const failureCount = log.failureCount ?? 0;
                                    return (
                                        <tr key={log.id} className="border-t border-gray-200">
                                            <td className="px-4 py-3 font-semibold text-gray-800">
                                                {log.title || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">
                                                {formatSentAt(log.sentAt)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                                {targetCount}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-rose-600">
                                                {failureCount}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}