import React, { useState } from 'react';
import ModalPortal from './ModalPortal';
import { Icon } from '../../utils/helpers';
import useAuth from '../../auth/useAuth';
import { ACCOUNT_DELETION_SUCCESS_MESSAGE, requestAccountDeletion } from '../../accountDeletion';

const GUIDE_TEXT = '계정 연결 및 개인정보 삭제를 요청합니다. 처리에는 영업일 기준 최대 7일이 소요될 수 있습니다.';

export default function AccountDeletionRequestButton({ onAfterRequested, className = '' }) {
  const { user, userProfile, role, profileDocId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (submitting) return;
    setIsOpen(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await requestAccountDeletion({ user, userProfile, role, profileDocId });
      alert(ACCOUNT_DELETION_SUCCESS_MESSAGE);
      await onAfterRequested?.();
    } catch (err) {
      console.error('[AccountDeletionRequestButton] request failed:', err);
      setError(err?.message || '탈퇴 요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className || 'flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 shadow-sm active:scale-[0.99]'}
      >
        <Icon name="trash" className="h-4 w-4" />
        계정 삭제 요청
      </button>

      {isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={close}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900">계정 삭제 요청</h3>
                </div>
                <button type="button" onClick={close} className="text-gray-400 hover:text-gray-700" aria-label="닫기">
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>

              <p className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                {GUIDE_TEXT}
              </p>


              {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={submitting}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {submitting ? '요청 중...' : '요청하기'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
