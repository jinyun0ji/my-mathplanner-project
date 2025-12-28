import React, { useMemo, useState } from 'react';
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase/client';
import { ROLE, isViewerGroupRole } from '../constants/roles';
import { signInWithGoogle } from '../auth/authService';

const normalizeInviteCode = (value) => (value || '').trim();

export default function InviteSignupPage() {
    const [inviteCode, setInviteCode] = useState('');
    const [name, setName] = useState('');
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const inviteCodeValue = useMemo(() => normalizeInviteCode(inviteCode), [inviteCode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db) return;

        setStatus('');
        setSubmitting(true);

        try {
            const code = normalizeInviteCode(inviteCode);
            if (!code) {
                setStatus('초대 코드를 입력해주세요.');
                return;
            }

            const authUser = await signInWithGoogle();
            if (!authUser?.uid) {
                setStatus('간편 로그인에 실패했습니다. 다시 시도해주세요.');
                return;
            }

            const inviteRef = doc(db, 'invites', code);
            const inviteSnap = await getDoc(inviteRef);
            if (!inviteSnap.exists()) {
                setStatus('유효하지 않거나 이미 사용된 초대 코드입니다.');
                return;
            }
            const inviteData = inviteSnap.data();
            const inviteRole = inviteData?.role;
            if (!isViewerGroupRole(inviteRole)) {
                setStatus('학생/학부모 전용 초대 코드만 사용할 수 있습니다.');
                return;
            }
            if (inviteData?.consumed) {
                setStatus('이미 사용된 초대 코드입니다.');
                return;
            }
            if (inviteData?.expiresAt?.toDate && inviteData.expiresAt.toDate() < new Date()) {
                setStatus('만료된 초대 코드입니다. 담당 선생님에게 문의해주세요.');
                return;
            }

            const studentDocId = inviteData?.target?.studentDocId
                ? String(inviteData.target.studentDocId).trim()
                : '';

            if (!studentDocId) {
                setStatus('초대 코드에 학생 문서 ID 정보가 없습니다. 담당자에게 문의해주세요.');
                return;
            }

            if (inviteRole === ROLE.STUDENT) {
                const studentRef = doc(db, 'users', studentDocId);
                const studentSnap = await getDoc(studentRef);

                if (!studentSnap.exists()) {
                    setStatus('학생 정보를 찾을 수 없습니다. 담당자에게 문의해주세요.');
                    return;
                }

                const studentData = studentSnap.data();
                if (studentData?.role !== ROLE.STUDENT) {
                    setStatus('학생 전용 초대 코드가 아닙니다. 담당자에게 문의해주세요.');
                    return;
                }

                if (studentData?.authUid && studentData.authUid !== authUser.uid) {
                    setStatus('이미 다른 계정에 연결된 학생입니다. 담당자에게 문의해주세요.');
                    return;
                }

                await updateDoc(studentRef, {
                    authUid: authUser.uid,
                    email: authUser.email?.trim() || '',
                    hasAccount: true,
                    updatedAt: serverTimestamp(),
                });

                await updateDoc(inviteRef, {
                    consumed: true,
                    consumedByAuthUid: authUser.uid,
                    consumedAt: serverTimestamp(),
                });

                setStatus('계정이 성공적으로 연결되었습니다. 잠시 후 자동으로 이동합니다.');
                return;
            }

            if (inviteRole === ROLE.PARENT) {
                const presetProfile = inviteData?.presetProfile ?? {};
                const parentRef = doc(db, 'users', authUser.uid);
                const parentSnap = await getDoc(parentRef);
                const parentData = parentSnap.exists() ? parentSnap.data() : {};

                if (parentData?.role && parentData.role !== ROLE.PARENT) {
                    setStatus('이미 다른 역할로 가입된 계정입니다. 담당자에게 문의해주세요.');
                    return;
                }

                const finalName = presetProfile?.displayName?.trim()
                    || presetProfile?.name?.trim()
                    || authUser.displayName?.trim()
                    || name.trim();

                if (!finalName) {
                    setStatus('이름을 입력해주세요.');
                    return;
                }

                const existingStudentIds = Array.isArray(parentData?.studentIds)
                    ? parentData.studentIds.filter(Boolean)
                    : [];
                const mergedStudentIds = Array.from(new Set([...existingStudentIds, studentDocId]));
                const resolvedActiveStudentId = parentData?.activeStudentId || studentDocId;

                const parentPayload = {
                    role: ROLE.PARENT,
                    authUid: authUser.uid,
                    displayName: finalName,
                    email: authUser.email?.trim() || presetProfile?.email?.trim() || '',
                    active: true,
                    inviteId: code,
                    studentIds: mergedStudentIds,
                    activeStudentId: mergedStudentIds.includes(resolvedActiveStudentId)
                        ? resolvedActiveStudentId
                        : mergedStudentIds[0],
                    createdAt: parentData?.createdAt || serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                await setDoc(parentRef, parentPayload, { merge: true });

                await updateDoc(inviteRef, {
                    consumed: true,
                    consumedByAuthUid: authUser.uid,
                    consumedAt: serverTimestamp(),
                });

                setStatus('가입이 완료되었습니다. 잠시 후 자동으로 이동합니다.');
                return;
            }

            setStatus('지원되지 않는 초대 코드입니다. 담당자에게 문의해주세요.');
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
                        disabled={submitting || !inviteCodeValue}
                        className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-[0.98] disabled:opacity-70"
                    >
                        {submitting ? '가입 처리 중...' : 'Google로 가입하기'}
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