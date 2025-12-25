import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase/client';
import { clearStoredState, getStoredState } from '../auth/socialRedirect';

const SUPPORTED_PROVIDERS = ['kakao', 'naver'];

const getFunctionsBaseUrl = () => process.env.REACT_APP_FUNCTIONS_BASE_URL || '';

const SocialCallback = () => {
    const [status, setStatus] = useState('pending');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const provider = searchParams.get('provider');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    useEffect(() => {
        const run = async () => {
            if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
                setError('지원하지 않는 프로바이더입니다.');
                setStatus('error');
                return;
            }

            if (!code) {
                setError('인증 코드가 누락되었습니다.');
                setStatus('error');
                return;
            }

            const expectedState = getStoredState(provider);
            if (expectedState && state && expectedState !== state) {
                setError('유효하지 않은 상태 값입니다.');
                setStatus('error');
                return;
            }

            try {
                const endpoint = `${getFunctionsBaseUrl()}/auth/${provider}`;
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, state }),
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || '서버 통신 중 오류가 발생했습니다.');
                }

                const { token } = await response.json();
                if (!token) {
                    throw new Error('토큰 발급에 실패했습니다.');
                }

                if (!auth) {
                    throw new Error('Firebase가 초기화되지 않았습니다.');
                }

                await signInWithCustomToken(auth, token);
                clearStoredState(provider);
                navigate('/lessons', { replace: true });
            } catch (err) {
                console.error(err);
                setError(err.message || '로그인 처리 중 오류가 발생했습니다.');
                setStatus('error');
            }
        };

        run();
    }, [code, navigate, provider, state]);

    const renderBody = () => {
        if (status === 'pending') {
            return (
                <div className="text-center space-y-4">
                    <div className="text-lg font-semibold">소셜 로그인 처리 중...</div>
                    <p className="text-sm text-gray-600">잠시만 기다려주세요.</p>
                </div>
            );
        }

        return (
            <div className="text-center space-y-4">
                <div className="text-lg font-semibold text-red-600">로그인에 실패했습니다.</div>
                <p className="text-sm text-gray-600">{error}</p>
                <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold"
                    onClick={() => navigate('/login', { replace: true })}
                >
                    돌아가기
                </button>
            </div>
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8">
                {renderBody()}
            </div>
        </div>
    );
};

export default SocialCallback;