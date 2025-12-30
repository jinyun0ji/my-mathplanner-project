import React, { useCallback, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Link } from 'react-router-dom';
import { functions } from '../firebase/client';
import { signInWithGoogle } from '../auth/authService';

const normalizeInviteCode = (value) => (value || '').trim();

const getReasonMessage = (reason) => {
    switch (reason) {
    case 'invalid_code':
        return '유효하지 않은 초대 코드입니다.';
    case 'role_not_allowed':
        return '학생/학부모 전용 초대 코드만 사용할 수 있습니다.';
    case 'consumed':
        return '이미 사용된 초대 코드입니다.';
    case 'expired':
        return '만료된 초대 코드입니다. 담당 선생님에게 문의해주세요.';
    case 'missing_target':
        return '초대 코드에 필요한 학생 정보가 없습니다. 담당자에게 문의해주세요.';
    default:
        return '초대 코드를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.';
    }
};

export default function InviteSignupPage() {
    const [inviteCode, setInviteCode] = useState('');
    const [name, setName] = useState('');
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [checkingInvite, setCheckingInvite] = useState(false);

    const inviteCodeValue = useMemo(() => normalizeInviteCode(inviteCode), [inviteCode]);

    const describeInvite = (resolvedInvite) => {
        if (!resolvedInvite?.inviteType) return '';
        if (resolvedInvite.inviteType === 'parent') return '학부모용 초대 코드가 확인되었습니다.';
        if (resolvedInvite.inviteType === 'student') return '학생용 초대 코드가 확인되었습니다.';
        return '초대 코드가 확인되었습니다.';
    };

    const verifyInviteCode = useCallback(async () => {
        if (!inviteCodeValue) {
            setStatus('초대 코드를 입력해주세요.');
            return null;
        }

        if (!functions) {
            setStatus('Firebase Functions를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            return null;
        }

        setCheckingInvite(true);
        try {
            const callable = httpsCallable(functions, 'resolveInviteCode');
            const { data } = await callable({ code: inviteCodeValue });
            if (data?.ok) {
                setStatus(describeInvite(data));
                return data;
            }

            setStatus(getReasonMessage(data?.reason));
            return null;
        } catch (error) {
            setStatus(error?.message || '초대 코드 검증에 실패했습니다. 다시 시도해주세요.');
            return null;
        } finally {
            setCheckingInvite(false);
        }
    }, [functions, inviteCodeValue]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('');
        setSubmitting(true);

        try {
            const authUser = await signInWithGoogle();

            const verified = await verifyInviteCode();
            if (!verified) {
                // setStatus('초대 코드가 유효하지 않습니다.');
                return;
            }

            const acceptCallable = httpsCallable(functions, 'acceptInviteAndCreateProfile');
            const { data } = await acceptCallable({
                code: inviteCodeValue,
                name: name.trim() || authUser.displayName || '',
            });

            if (!authUser?.uid) {
                setStatus('간편 로그인에 실패했습니다. 다시 시도해주세요.');
                return;
            }

            if (!functions) {
                setStatus('Firebase Functions를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
                return;
            }

            if (data?.ok) {
                setStatus('가입이 완료되었습니다. 잠시 후 자동으로 이동합니다.');
                setTimeout(() => {
                    window.location.href = '/home';
                }, 1200);
                return;
            }
                
        setStatus(getReasonMessage(data?.reason));
        } catch (error) {
            setStatus(error?.message || '회원가입에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">초대 코드로 가입하기</h1>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        학원에서 받은 초대 코드를 입력해 학생 또는 학부모 계정을 생성합니다.
                    </p>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit}>
                    <label className="block text-left space-y-1">
                        <span className="text-sm font-semibold text-gray-700">초대 코드</span>
                        <input
                            type="text"
                            required
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="예: ABC123"
                            autoComplete="one-time-code"
                        />
                    </label>

                    <label className="block text-left space-y-1">
                        <span className="text-sm font-semibold text-gray-700">이름</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="초대 문서에 이름이 없으면 입력해주세요."
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={submitting || checkingInvite || !inviteCodeValue}
                        className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-[0.98] disabled:opacity-70"
                    >
                        {submitting
                            ? '가입 처리 중...'
                            : checkingInvite
                                ? '초대 코드 확인 중...'
                                : 'Google로 가입하기'}
                    </button>
                </form>

                <div className="bg-indigo-50 text-indigo-900 rounded-xl p-4 text-sm">
                    <p className="font-semibold">초대 코드가 없나요?</p>
                    <p className="mt-1 text-indigo-800">담당 선생님에게 초대 코드를 요청해주세요.</p>
                </div>

                <div className="text-center text-sm text-gray-500">
                    이미 계정이 있나요?{' '}
                    <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
                        로그인하러 가기
                    </Link>
                </div>

                {status && (
                    <p className="text-sm text-center text-gray-700 bg-gray-50 rounded-xl p-3">{status}</p>
                )}
            </div>
        </div>
    );
}