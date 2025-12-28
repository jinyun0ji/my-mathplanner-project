import React, { useEffect, useMemo, useState } from 'react';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
} from 'firebase/firestore';
import useAuth from '../../auth/useAuth';
import { ROLE } from '../../constants/roles';
import { db } from '../../firebase/client';

const DEFAULT_VALIDITY_DAYS = 7;

const toInputDateTimeValue = (date) => {
    const tzOffsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const formatTimestamp = (value) => {
    if (!value) return '-';
    if (value.toDate) return value.toDate().toLocaleString('ko-KR');
    if (value instanceof Date) return value.toLocaleString('ko-KR');
    return '-';
};

const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    const date = expiresAt.toDate ? expiresAt.toDate() : expiresAt;
    return date < new Date();
};

const generateInviteCode = () => {
    const prefixes = ['MATH', 'STUDY', 'CLASS', 'CAMPUS'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Array.from({ length: 4 }, () => Math.floor(Math.random() * 36).toString(36).toUpperCase()).join('');
    return `${prefix}-${suffix}`;
};

export default function InviteManagementPage() {
    const { user } = useAuth();
    const [role, setRole] = useState(ROLE.STUDENT);
    const [studentId, setStudentId] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [expiresAtInput, setExpiresAtInput] = useState(() => {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + DEFAULT_VALIDITY_DAYS);
        return toInputDateTimeValue(defaultDate);
    });
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [invites, setInvites] = useState([]);
    const [isLoadingInvites, setIsLoadingInvites] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');

    const filteredInvites = useMemo(
        () => [...invites].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
        [invites],
    );

    const loadInvites = async () => {
        if (!db) return;
        setIsLoadingInvites(true);
        setError('');
        try {
            const snapshot = await getDocs(query(collection(db, 'invites'), orderBy('createdAt', 'desc'), limit(50)));
            setInvites(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        } catch (loadError) {
            setError(loadError?.message || '초대 코드를 불러오지 못했습니다.');
        } finally {
            setIsLoadingInvites(false);
        }
    };

    useEffect(() => {
        loadInvites();
    }, []);

    const findUniqueCode = async () => {
        if (!db) return generateInviteCode();
        let attempts = 0;
        while (attempts < 5) {
            const candidate = generateInviteCode();
            // eslint-disable-next-line no-await-in-loop
            const exists = await getDoc(doc(db, 'invites', candidate));
            if (!exists.exists()) return candidate;
            attempts += 1;
        }
        return generateInviteCode();
    };

    const handleCreateInvite = async (e) => {
        e.preventDefault();
        if (!db || !user?.uid) {
            setError('Firebase 초기화 또는 사용자 정보가 필요합니다.');
            return;
        }

        setStatus('');
        setError('');
        setIsCreating(true);
        setGeneratedCode('');

        try {
            if (role === ROLE.PARENT && !studentId.trim()) {
                setError('학부모 초대에는 연결할 학생 ID가 필요합니다.');
                return;
            }

            const expiresDate = expiresAtInput ? new Date(expiresAtInput) : null;
            if (!expiresDate || Number.isNaN(expiresDate.getTime())) {
                setError('유효기간을 올바르게 입력해주세요.');
                return;
            }

            const inviteCode = await findUniqueCode();
            const presetProfile = {};
            if (name.trim()) presetProfile.name = name.trim();
            if (email.trim()) presetProfile.email = email.trim();

            const payload = {
            code: inviteCode,
            role,
            target: role === ROLE.PARENT
                ? { studentId: String(studentId).trim() }
                : {},
            ...(Object.keys(presetProfile).length > 0
                ? { presetProfile }
                : {}),
            expiresAt: Timestamp.fromDate(expiresDate),
            consumed: false,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            };

            await setDoc(doc(db, 'invites', inviteCode), payload);
            setStatus('초대 코드가 생성되었습니다. 아래 목록에서 확인하세요.');
            setGeneratedCode(inviteCode);
            setName('');
            setEmail('');
            if (role === ROLE.STUDENT) {
                setStudentId('');
            }
            loadInvites();
        } catch (createError) {
            setError(createError?.message || '초대 코드 생성에 실패했습니다.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopy = async (code) => {
        try {
            await navigator.clipboard.writeText(code);
            setStatus('초대 코드가 클립보드에 복사되었습니다.');
        } catch (copyError) {
            setError(copyError?.message || '클립보드 복사에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">직원/관리자/강사 전용</p>
                    <h1 className="text-2xl font-bold text-gray-800">학생/학부모 초대 코드</h1>
                    <p className="text-sm text-gray-500">
                        초대 코드를 생성하고 만료 상태를 한 곳에서 관리하세요. 기본 유효기간은 생성일로부터 7일입니다.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">새 초대 코드 생성</h2>
                        <p className="text-sm text-gray-500">대상 역할과 유효기간을 지정하여 초대 코드를 발급합니다.</p>
                    </div>
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100">
                        기본 {DEFAULT_VALIDITY_DAYS}일
                    </span>
                </div>

                <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleCreateInvite}>
                    <div className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700">초대 대상</span>
                        <div className="flex gap-3">
                            <label className={`flex-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${role === ROLE.STUDENT ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700'}`}>
                                <input
                                    type="radio"
                                    name="inviteRole"
                                    value={ROLE.STUDENT}
                                    checked={role === ROLE.STUDENT}
                                    onChange={() => setRole(ROLE.STUDENT)}
                                    className="text-indigo-600 focus:ring-indigo-500"
                                />
                                학생
                            </label>
                            <label className={`flex-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${role === ROLE.PARENT ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700'}`}>
                                <input
                                    type="radio"
                                    name="inviteRole"
                                    value={ROLE.PARENT}
                                    checked={role === ROLE.PARENT}
                                    onChange={() => setRole(ROLE.PARENT)}
                                    className="text-indigo-600 focus:ring-indigo-500"
                                />
                                학부모
                            </label>
                        </div>
                    </div>

                    {role === ROLE.PARENT && (
                        <label className="space-y-1">
                            <span className="text-sm font-semibold text-gray-700">연결할 학생 ID</span>
                            <input
                                type="text"
                                required
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="예: STU-2025-001"
                            />
                        </label>
                    )}

                    <label className="space-y-1">
                        <span className="text-sm font-semibold text-gray-700">이름 (선택)</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="초대장에 보여질 이름"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-sm font-semibold text-gray-700">이메일 (선택)</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="예: student@example.com"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-sm font-semibold text-gray-700">유효기간</span>
                        <input
                            type="datetime-local"
                            value={expiresAtInput}
                            onChange={(e) => setExpiresAtInput(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </label>

                    <div className="md:col-span-2 flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-md hover:bg-indigo-700 transition disabled:opacity-70"
                        >
                            {isCreating ? '생성 중...' : '초대 코드 생성'}
                        </button>
                        {generatedCode && (
                            <div className="flex items-center gap-2 text-sm text-gray-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                                <span className="font-bold text-indigo-700">{generatedCode}</span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(generatedCode)}
                                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                                >
                                    복사하기
                                </button>
                            </div>
                        )}
                    </div>
                </form>

                {(status || error) && (
                    <div className={`rounded-xl px-4 py-3 text-sm ${error ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                        {error || status}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">초대 코드 목록</h2>
                        <p className="text-sm text-gray-500">최근 생성된 초대 코드의 만료/사용 상태를 확인하세요.</p>
                    </div>
                    <button
                        type="button"
                        onClick={loadInvites}
                        className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                        disabled={isLoadingInvites}
                    >
                        {isLoadingInvites ? '새로고침 중...' : '새로고침'}
                    </button>
                </div>

                {isLoadingInvites && <p className="mt-4 text-sm text-gray-500">초대 코드를 불러오는 중입니다...</p>}
                {!isLoadingInvites && filteredInvites.length === 0 && (
                    <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                        <p className="text-sm font-semibold text-gray-700">아직 생성된 초대 코드가 없습니다</p>
                        <p className="text-xs text-gray-500 mt-2">초대 코드를 생성하면 목록에 표시됩니다.</p>
                    </div>
                )}

                {!isLoadingInvites && filteredInvites.length > 0 && (
                    <div className="mt-4 overflow-x-auto border border-gray-200 rounded-xl">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">코드</th>
                                    <th className="px-4 py-3 text-left font-semibold">역할</th>
                                    <th className="px-4 py-3 text-left font-semibold">학생 ID</th>
                                    <th className="px-4 py-3 text-left font-semibold">만료일</th>
                                    <th className="px-4 py-3 text-left font-semibold">상태</th>
                                    <th className="px-4 py-3 text-right font-semibold">액션</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvites.map((invite) => {
                                    const expired = isExpired(invite.expiresAt);
                                    const consumed = invite.consumed;
                                    const badgeClass = consumed
                                        ? 'bg-gray-100 text-gray-600 border border-gray-200'
                                        : expired
                                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                                    const badgeLabel = consumed ? '사용됨' : expired ? '만료됨' : '유효';

                                    return (
                                        <tr key={invite.id} className="border-t border-gray-200">
                                            <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{invite.code || invite.id}</td>
                                            <td className="px-4 py-3 text-gray-700 capitalize">{invite.role}</td>
                                            <td className="px-4 py-3 text-gray-600">{invite.target?.studentId || '-'}</td>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTimestamp(invite.expiresAt)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                                                    {badgeLabel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(invite.code || invite.id)}
                                                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                                                >
                                                    복사하기
                                                </button>
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