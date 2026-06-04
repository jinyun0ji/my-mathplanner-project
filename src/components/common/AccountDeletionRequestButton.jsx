import React, { useState } from 'react';
import ModalPortal from './ModalPortal';
import { Icon } from '../../utils/helpers';
import { requestAccountDeletion } from '../../accountDeletion';

const GUIDE_TEXT = '탈퇴 요청 시 계정은 즉시 서비스 이용이 제한되며, 학습 기록은 개인정보처리방침에 따른 보관 기간 동안 분리 보관 후 삭제될 수 있습니다.';

export default function AccountDeletionRequestButton({ onAfterRequested, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (submitting) return;
    setIsOpen(false);
    setChecked(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await requestAccountDeletion();
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
        계정 탈퇴 요청
      </button>

      {isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={close}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900">계정 탈퇴 요청</h3>
                  <p className="mt-1 text-xs text-gray-500">요청 즉시 서비스 이용이 제한됩니다.</p>
                </div>
                <button type="button" onClick={close} className="text-gray-400 hover:text-gray-700" aria-label="닫기">
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>

              <p className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                {GUIDE_TEXT}
              </p>

              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                위 내용을 확인했습니다.
              </label>

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
                  disabled={!checked || submitting}
                  className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {submitting ? '요청 중...' : '탈퇴 요청'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
