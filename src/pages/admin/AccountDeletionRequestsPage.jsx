import React, { useEffect, useState } from 'react';
import useAuth from '../../auth/useAuth';
import { completeAccountDeletionRequest, getPendingAccountDeletionRequests } from '../../admin/accountDeletionRequestsService';

const formatTimestamp = (value) => {
  const date = value?.toDate?.();
  if (!date) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const EMPTY_TEXT = '대기 중인 계정 삭제 요청이 없습니다.';

export default function AccountDeletionRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completingId, setCompletingId] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const pendingRequests = await getPendingAccountDeletionRequests();
      setRequests(pendingRequests);
    } catch (err) {
      console.error('[AccountDeletionRequestsPage] load failed:', err);
      setError('계정 삭제 요청 목록을 불러오지 못했습니다. 권한 또는 네트워크를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleComplete = async (request) => {
    if (!window.confirm(`${request.displayName || request.email || request.id} 요청을 처리 완료로 변경할까요?`)) return;

    setCompletingId(request.id);
    setError('');
    try {
      await completeAccountDeletionRequest(request.id, user?.uid || '');
      setRequests((current) => current.filter((item) => item.id !== request.id));
    } catch (err) {
      console.error('[AccountDeletionRequestsPage] complete failed:', err);
      setError('처리 완료 저장에 실패했습니다. 권한 또는 네트워크를 확인해주세요.');
    } finally {
      setCompletingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">계정 삭제 요청 관리</h1>
            <p className="mt-2 text-sm text-gray-500">pending 상태의 계정 연결 및 개인정보 삭제 요청을 확인하고 완료 처리합니다.</p>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            disabled={loading}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            새로고침
          </button>
        </div>
        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <tr>
                {['요청일', '이름', '이메일', '역할', 'userDocId', 'requesterAuthUid', '상태', '관리'].map((header) => (
                  <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr><td colSpan="8" className="px-4 py-10 text-center font-semibold text-gray-500">불러오는 중...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-10 text-center font-semibold text-gray-500">{EMPTY_TEXT}</td></tr>
              ) : requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatTimestamp(request.requestedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{request.displayName || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{request.email || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{request.role || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600">{request.userDocId || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600">{request.requesterAuthUid || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{request.status || '-'}</span></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button type="button" onClick={() => handleComplete(request)} disabled={completingId === request.id} className="rounded-lg bg-[#455fab] px-3 py-2 text-xs font-bold text-white disabled:bg-gray-300">
                      {completingId === request.id ? '저장 중...' : '처리 완료'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
