import React, { useMemo, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase/client';

const normalizeInviteCode = (value) => (value || '').trim();

export default function InviteSignupPage() {
    const [inviteCode, setInviteCode] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const inviteCodeValue = useMemo(() => normalizeInviteCode(inviteCode), [inviteCode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db || !auth) return;

        setStatus('');
        setSubmitting(true);

        try {
            const code = normalizeInviteCode(inviteCode);
            if (!code) {
                setStatus('초대 코드를 입력해주세요.');
                return;
            }

            const inviteQuery = query(
                collection(db, 'users'),
                where('inviteCode', '==', code),
                where('invited', '==', true),
                where('active', '==', true),
                limit(2),
            );
            const inviteSnap = await getDocs(inviteQuery);
            if (inviteSnap.empty) {
                setStatus('유효하지 않거나 이미 사용된 초대 코드입니다.');
                return;
            }
            if (inviteSnap.size > 1) {
                setStatus('초대 코드가 중복되어 있습니다. 관리자에게 문의해주세요.');
                return;
            }

            const inviteDoc = inviteSnap.docs[0];
            const inviteData = inviteDoc.data();
            if (!['student', 'parent'].includes(inviteData?.role)) {
                setStatus('학생/학부모 전용 초대 코드만 사용할 수 있습니다.');
                return;
            }
            if (inviteData?.authUid) {
                setStatus('이미 사용된 초대 코드입니다.');
                return;
            }

            const finalName = inviteData?.name?.trim() || name.trim();
            if (!finalName) {
                setStatus('이름을 입력해주세요.');
                return;
            }

            const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const { user } = credential;
            if (!user?.uid) {
                setStatus('회원가입에 실패했습니다. 다시 시도해주세요.');
                return;
            }

            const invitePayload = {
                ...inviteData,
                authUid: user.uid,
                invited: false,
                email: email.trim(),
                name: finalName,
                updatedAt: serverTimestamp(),
            };

            await updateDoc(doc(db, 'users', inviteDoc.id), invitePayload);
            await setDoc(doc(db, 'users', user.uid), invitePayload, { merge: true });
            if (inviteDoc.id !== user.uid) {
                await deleteDoc(inviteDoc.ref);
            }

            setStatus('가입이 완료되었습니다. 잠시 후 대시보드로 이동합니다.');
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
                        <span className="text-sm font-semibold text-gray-700">이메일</span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="example@email.com"
                        />
                    </label>

                    <label className="block text-left space-y-1">
                        <span className="text-sm font-semibold text-gray-700">비밀번호</span>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="6자리 이상"
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
                        disabled={submitting || !inviteCodeValue}
                        className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-[0.98] disabled:opacity-70"
                    >
                        {submitting ? '가입 처리 중...' : '초대 코드로 가입하기'}
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