import React, { useCallback, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase/client';
import { ROLE, isParentRole, isStudentRole } from '../constants/roles';
import useAuth from './useAuth';
import { getDefaultRouteForRole } from './authRedirects';

export default function StudentLogin() {
    const { user, role, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;
        if (!user) return;

        const redirectPath = getDefaultRouteForRole(role) || '/home';
        navigate(redirectPath, { replace: true });
    }, [loading, navigate, role, user]);

    const handleLogin = useCallback(async () => {
        setError('');
        setPending(true);

        try {
            const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
            const { user: loggedInUser } = credential;

            if (!loggedInUser?.uid) {
                setError('로그인에 실패했습니다. 다시 시도해주세요.');
                return;
            }

            const userDoc = await getDoc(doc(db, 'users', loggedInUser.uid));
            if (!userDoc.exists()) {
                setError('초대 기반 가입이 필요합니다. 관리자에게 문의하세요.');
                await signOut(auth);
                return;
            }

            const userData = userDoc.data();
            const userRole = userData?.role;

            if (!isStudentRole(userRole) && !isParentRole(userRole)) {
                setError('학생/학부모 전용 페이지입니다.');
                await signOut(auth);
                return;
            }

            const redirectPath = userRole === ROLE.PARENT ? '/parent/home' : '/student/home';
            navigate(redirectPath, { replace: true });
        } catch (loginError) {
            setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
        } finally {
            setPending(false);
        }
    }, [email, navigate, password]);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (pending) return;
        handleLogin();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-gray-900">학생/학부모 로그인</h2>
                    <p className="text-sm text-gray-500">이메일과 비밀번호로 로그인해주세요.</p>
                </div>

                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">이메일</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="student@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="비밀번호를 입력하세요"
                            required
                        />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={pending}
                        className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {pending ? '로그인 중...' : '로그인'}
                    </button>
                </form>
            </div>
        </div>
    );
}