import React, { useState } from 'react';

export default function OnboardingPage({ onSubmitLinkCode }) {
    const [linkCode, setLinkCode] = useState('');
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!onSubmitLinkCode) return;

        setStatus('');
        setSubmitting(true);
        try {
            await onSubmitLinkCode(linkCode);
            setStatus('학생 계정을 연결했습니다. 잠시 후 학부모 화면으로 이동합니다.');
        } catch (error) {
            setStatus(error?.message || '연결에 실패했습니다. 코드를 확인해주세요.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">학생 연결이 필요해요</h1>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        학원에서 발급한 연결 코드를 입력하면 학부모 계정으로 전환됩니다.
                    </p>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit}>
                    <label className="block text-left space-y-1">
                        <span className="text-sm font-semibold text-gray-700">연결 코드</span>
                        <input
                            type="text"
                            required
                            value={linkCode}
                            onChange={(e) => setLinkCode(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="예: ABC123"
                            autoComplete="one-time-code"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-[0.98] disabled:opacity-70"
                    >
                        {submitting ? '연결 중...' : '학생 계정 연결하기'}
                    </button>
                </form>

                <div className="bg-indigo-50 text-indigo-900 rounded-xl p-4 text-sm">
                    <p className="font-semibold">연결 코드가 없나요?</p>
                    <p className="mt-1 text-indigo-800">담당 선생님에게 학부모 연결 코드를 요청해주세요.</p>
                </div>

                {status && (
                    <p className="text-sm text-center text-gray-700 bg-gray-50 rounded-xl p-3">{status}</p>
                )}
            </div>
        </div>
    );
}
