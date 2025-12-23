import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../utils/helpers';
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase/client';
import { retryNotification } from '../admin/notificationService.js';

export default function Home({ onQuickAction, onCreateStaffUser, onCreateLinkCode, userRole }) {
    const [staffEmail, setStaffEmail] = useState('');
    const [staffTempPassword, setStaffTempPassword] = useState('');
    const [staffStatus, setStaffStatus] = useState('');
    const [staffSubmitting, setStaffSubmitting] = useState(false);
    const [linkStudentId, setLinkStudentId] = useState('');
    const [linkCodeResult, setLinkCodeResult] = useState('');
    const [linkStatus, setLinkStatus] = useState('');
    const [linkSubmitting, setLinkSubmitting] = useState(false);
    const [notificationLogs, setNotificationLogs] = useState([]);
    const [logType, setLogType] = useState('all');
    const [logStartDate, setLogStartDate] = useState('');
    const [logEndDate, setLogEndDate] = useState('');
    const [logLoading, setLogLoading] = useState(false);
    const [logError, setLogError] = useState('');
    const [retryingLogId, setRetryingLogId] = useState(null);
    const isAdmin = userRole === 'admin';

    const notificationTypes = useMemo(() => ([
        { label: '전체', value: 'all' },
        { label: '수업일지', value: 'LESSON_UPDATED' },
        { label: '출결', value: 'ATTENDANCE_UPDATED' },
        { label: '과제', value: 'HOMEWORK_GRADED' },
        { label: '성적', value: 'GRADE_PUBLISHED' },
        { label: '채팅', value: 'CHAT_MESSAGE' },
    ]), []);

    const fetchLogs = useCallback(async () => {
        if (!isAdmin || !db) {
            setNotificationLogs([]);
            return;
        }

        setLogLoading(true);
        setLogError('');

        try {
            const constraints = [orderBy('createdAt', 'desc'), limit(50)];

            if (logType !== 'all') {
                constraints.push(where('type', '==', logType));
            }

            if (logStartDate) {
                const start = new Date(logStartDate);
                start.setHours(0, 0, 0, 0);
                constraints.push(where('createdAt', '>=', Timestamp.fromDate(start)));
            }

            if (logEndDate) {
                const end = new Date(logEndDate);
                end.setHours(23, 59, 59, 999);
                constraints.push(where('createdAt', '<=', Timestamp.fromDate(end)));
            }

            const snapshot = await getDocs(query(collection(db, 'notificationLogs'), ...constraints));
            setNotificationLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            setLogError(error?.message || '알림 로그를 불러오지 못했습니다.');
        } finally {
            setLogLoading(false);
        }
    }, [db, isAdmin, logType, logStartDate, logEndDate]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleRetryNotification = async (logId) => {
        if (!logId) {
            return;
        }

        setRetryingLogId(logId);
        setLogError('');

        try {
            await retryNotification({ logId });
            await fetchLogs();
        } catch (error) {
            setLogError(error?.message || '알림 재전송에 실패했습니다.');
        } finally {
            setRetryingLogId(null);
        }
    };

    const stats = [
        { label: '총 재원생', value: '42명', change: '+2명', type: 'increase', icon: 'users', color: 'indigo' },
        { label: '오늘 출석률', value: '95%', change: '-2%', type: 'decrease', icon: 'checkCircle', color: 'green' },
        { label: '미납 수강료', value: '120만', change: '관리 필요', type: 'warning', icon: 'alertCircle', color: 'red' },
        { label: '이번 주 상담', value: '5건', change: '예정됨', type: 'neutral', icon: 'messageSquare', color: 'blue' },
    ];

    const quickActions = [
        { key: 'newStudent', label: '신규생 등록', icon: 'userPlus', hint: '기본 정보와 반 배정', tone: 'indigo' },
        { key: 'announcement', label: '전체 공지', icon: 'messageSquare', hint: '문자/알림 발송', tone: 'blue' },
        { key: 'payment', label: '수납 처리', icon: 'creditCard', hint: '결제 및 영수증', tone: 'emerald' },
        { key: 'worklog', label: '일지 작성', icon: 'fileText', hint: '수업/상담 기록', tone: 'orange' },
        { key: 'attendance', label: '출결 체크', icon: 'checkSquare', hint: '실시간 출결 입력', tone: 'violet' },
    ];

    const reminders = [
        { title: '오늘 출결 미완료 3건', description: '1·2교시 고1 심화반 확인 필요', icon: 'alertTriangle', tone: 'amber' },
        { title: '상담 준비', description: '김민준 학생 상담 시 학부모 의견 반영', icon: 'messageCircle', tone: 'sky' },
        { title: '교재 업데이트', description: '고2 수학(상) A반 프린트 최신본 업로드', icon: 'fileText', tone: 'indigo' },
    ];

    const toneStyles = {
        indigo: 'bg-indigo-50 text-indigo-900 border-indigo-100',
        blue: 'bg-blue-50 text-blue-800 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
        orange: 'bg-orange-50 text-orange-800 border-orange-100',
        violet: 'bg-violet-50 text-violet-800 border-violet-100',
        rose: 'bg-rose-50 text-rose-800 border-rose-100',
        amber: 'bg-amber-50 text-amber-800 border-amber-100',
        sky: 'bg-sky-50 text-sky-800 border-sky-100',
    };

    const hoverToneStyles = {
        indigo: 'hover:bg-indigo-50',
        blue: 'hover:bg-blue-50',
        emerald: 'hover:bg-emerald-50',
        orange: 'hover:bg-orange-50',
        violet: 'hover:bg-violet-50',
        rose: 'hover:bg-rose-50',
        amber: 'hover:bg-amber-50',
        sky: 'hover:bg-sky-50',
    };

    const handleCreateStaffSubmit = async (e) => {
        e.preventDefault();
        if (!onCreateStaffUser) return;

        setStaffStatus('');
        setStaffSubmitting(true);
        try {
            await onCreateStaffUser({ email: staffEmail, tempPassword: staffTempPassword });
            setStaffStatus('직원 계정을 생성했습니다. 임시 비밀번호를 전달해주세요.');
            setStaffEmail('');
            setStaffTempPassword('');
        } catch (error) {
            setStaffStatus(error?.message || '직원 생성 중 오류가 발생했습니다.');
        } finally {
            setStaffSubmitting(false);
        }
    };

    const handleCreateLinkCodeSubmit = async (e) => {
        e.preventDefault();
        if (!onCreateLinkCode) return;

        setLinkStatus('');
        setLinkSubmitting(true);
        try {
            const result = await onCreateLinkCode({ studentId: linkStudentId });
            setLinkCodeResult(result?.code || '');
            setLinkStatus('연결 코드를 생성했습니다. 학부모에게 전달하세요.');
        } catch (error) {
            setLinkStatus(error?.message || '연결 코드 생성 중 오류가 발생했습니다.');
        } finally {
            setLinkSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 lg:space-y-8 pb-2">
            {onCreateStaffUser && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-100">
                                <Icon name="shield" className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">관리자 전용</p>
                                <p className="text-base font-bold text-gray-800">직원 계정 생성</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100">
                            Allowlist 인증 필요
                        </span>
                    </div>
                    <form className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_auto] gap-3 items-end" onSubmit={handleCreateStaffSubmit}>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-gray-600">직원 이메일</span>
                            <input
                                type="email"
                                required
                                value={staffEmail}
                                onChange={(e) => setStaffEmail(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="staff@example.com"
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-gray-600">임시 비밀번호</span>
                            <input
                                type="text"
                                required
                                value={staffTempPassword}
                                onChange={(e) => setStaffTempPassword(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="초기 로그인용 비밀번호"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={staffSubmitting}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-900 text-white px-4 py-2.5 text-sm font-semibold shadow hover:bg-indigo-800 disabled:opacity-60"
                        >
                            <Icon name={staffSubmitting ? 'loader' : 'userPlus'} className="w-4 h-4" />
                            {staffSubmitting ? '생성 중...' : '직원 계정 생성'}
                        </button>
                    </form>
                    {staffStatus && <p className="text-sm text-gray-600">{staffStatus}</p>}
                </div>
            )}

            {onCreateLinkCode && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-100">
                                <Icon name="link" className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">직원 전용</p>
                                <p className="text-base font-bold text-gray-800">학부모 연결 코드 생성</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                            학생 ID 필요
                        </span>
                    </div>
                    <form className="grid grid-cols-1 md:grid-cols-[2fr_auto] gap-3 items-end" onSubmit={handleCreateLinkCodeSubmit}>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-gray-600">학생 ID</span>
                            <input
                                type="text"
                                required
                                value={linkStudentId}
                                onChange={(e) => setLinkStudentId(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="예: student123"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={linkSubmitting}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold shadow hover:bg-emerald-500 disabled:opacity-60"
                        >
                            <Icon name={linkSubmitting ? 'loader' : 'key'} className="w-4 h-4" />
                            {linkSubmitting ? '생성 중...' : '연결 코드 생성'}
                        </button>
                    </form>
                    {linkCodeResult && (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-900 flex items-center justify-between">
                            <span className="font-semibold">발급된 코드</span>
                            <code className="text-base font-bold tracking-widest">{linkCodeResult}</code>
                        </div>
                    )}
                    {linkStatus && <p className="text-sm text-gray-600">{linkStatus}</p>}
                </div>
            )}

            {isAdmin && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-900 border border-rose-100">
                                <Icon name="bell" className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">관리자 전용</p>
                                <p className="text-base font-bold text-gray-800">알림 발송 로그</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-800 border border-rose-100">
                            최근 50건
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-gray-600">유형</span>
                            <select
                                value={logType}
                                onChange={(e) => setLogType(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                            >
                                {notificationTypes.map((type) => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-gray-600">시작일</span>
                            <input
                                type="date"
                                value={logStartDate}
                                onChange={(e) => setLogStartDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-gray-600">종료일</span>
                            <input
                                type="date"
                                value={logEndDate}
                                onChange={(e) => setLogEndDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                            />
                        </label>
                    </div>

                    {logLoading && (
                        <div className="text-sm text-gray-500">로그를 불러오는 중...</div>
                    )}
                    {logError && (
                        <div className="text-sm text-red-500">{logError}</div>
                    )}

                    {!logLoading && !logError && (
                        <div className="space-y-3">
                            {notificationLogs.length === 0 ? (
                                <div className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                                    조건에 맞는 로그가 없습니다.
                                </div>
                            ) : (
                                notificationLogs.map((log) => {
                                    const targetCount = log.targetCount ?? log.targetUserCount ?? 0;
                                    const failureCount = log.failureCount || 0;
                                    const successCount = log.successCount || 0;
                                    const failureRate = targetCount === 0 ? 0 : Math.round((failureCount / targetCount) * 100);
                                    const createdAt = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('ko-KR') : '-';
                                    const eventType = log.eventType || log.type || '-';
                                    const retryAttempted = Boolean(log.retry?.attempted);
                                    const canRetry = failureCount > 0;
                                    const isFailureHighlighted = failureCount > 0;
                                    return (
                                        <div
                                            key={log.id}
                                            className={`border rounded-xl p-4 flex flex-col gap-2 ${
                                                isFailureHighlighted ? 'border-red-200 bg-red-50/40' : 'border-gray-200'
                                            }`}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                                        {eventType}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{createdAt}</span>
                                                    {retryAttempted && (
                                                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                                            재전송 완료
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-gray-500">
                                                        실패율 {failureRate}%
                                                    </span>
                                                    {canRetry && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRetryNotification(log.id)}
                                                            disabled={retryAttempted || retryingLogId === log.id}
                                                            className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {retryingLogId === log.id ? '재전송 중...' : '재전송'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400">대상</span>
                                                    <span className="font-semibold text-gray-800">{targetCount}명</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400">성공</span>
                                                    <span className="font-semibold text-emerald-600">{successCount}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400">실패</span>
                                                    <span className="font-semibold text-red-500">{failureCount}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400">실패 토큰</span>
                                                    <span className="font-semibold text-orange-500">{log.failedTokenCount || 0}</span>
                                                </div>
                                            </div>
                                            {retryAttempted && (
                                                <div className="text-xs text-gray-500">
                                                    재전송 결과: 성공 {log.retry?.retrySuccessCount || 0} · 실패 {log.retry?.retryFailureCount || 0}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(260px,1fr)]">
                <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.28),transparent_40%),radial-gradient(circle_at_80%_15%,rgba(45,212,191,0.26),transparent_38%),linear-gradient(135deg,#0a1434,#1d4ed8,#0d9488)] p-6 lg:p-7 shadow-lg text-white">
                    <div className="absolute inset-y-0 right-0 w-48 bg-white/10 blur-3xl" aria-hidden></div>
                    <div className="relative flex flex-col gap-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <p className="text-sm text-sky-100">오늘도 힘찬 하루 보내세요.</p>
                                <h2 className="text-2xl lg:text-3xl font-bold">환영합니다, 채수용 선생님! 👋</h2>
                                <p className="text-sky-100 text-sm">직원용 홈에서 주요 업무를 바로 확인해보세요.</p>
                            </div>
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 max-w-xs w-full sm:w-auto">
                                <p className="text-xs font-medium text-sky-100">Today</p>
                                <p className="text-lg lg:text-xl font-bold">12월 12일 (금)</p>
                                <p className="text-xs text-sky-100 mt-1">주요 메모 {reminders.length}건</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[13px]">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold backdrop-blur">
                                <Icon name="checkCircle" className="w-4 h-4" /> 핵심 지표 한눈에 보기
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold backdrop-blur">
                                <Icon name="smartphone" className="w-4 h-4" /> 모바일에서도 편리하게
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-100">
                                <Icon name="activity" className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">오늘의 브리핑</p>
                                <p className="text-base font-bold text-gray-800">업무 체크리스트</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100">Live</span>
                    </div>
                    <div className="space-y-3">
                        {reminders.map((item, idx) => (
                            <div key={idx} className={`flex items-start gap-3 rounded-xl border ${toneStyles[item.tone]} p-3`}>
                                <div className={`p-2 rounded-lg ${toneStyles[item.tone]} shadow-inner border`}>
                                    <Icon name={item.icon} className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-800">{item.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1 truncate">{stat.value}</h3>
                            </div>
                            <div className={`p-2.5 rounded-lg ${
                                stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-900' :
                                stat.color === 'green' ? 'bg-green-50 text-green-700' :
                                stat.color === 'red' ? 'bg-red-50 text-red-600' :
                                'bg-blue-50 text-blue-600'
                            }`}>
                                <Icon name={stat.icon} className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-left">
                            <span className={`font-bold flex items-center ${
                                stat.type === 'increase' ? 'text-green-600' :
                                stat.type === 'decrease' ? 'text-red-500' :
                                stat.type === 'warning' ? 'text-orange-500' : 'text-gray-500'
                            }`}>
                                {stat.change}
                            </span>
                            <span className="text-gray-400 ml-1.5">vs 지난달</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800">빠른 실행</h3>
                        <span className="text-xs text-gray-400">모바일 친화형 버튼</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {quickActions.map((action, idx) => (
                            <button 
                                key={idx} 
                                type="button"
                                onClick={() => onQuickAction?.(action.key)}
                                className={`p-4 rounded-xl border border-gray-200 hover:border-indigo-900 transition flex flex-col items-start text-left group bg-gray-50/50 min-w-0 ${hoverToneStyles[action.tone]}`}
                            >
                                <div className={`p-2 rounded-lg ${toneStyles[action.tone]} font-bold flex items-center justify-center text-sm shadow-inner`}>
                                    <Icon name={action.icon} className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-900 transition-colors mt-3 truncate">{action.label}</span>
                                <span className="text-[11px] text-gray-500 group-hover:text-indigo-800 transition-colors mt-1 leading-relaxed break-words">{action.hint}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800">업무 브리핑</h3>
                        <span className="text-xs text-gray-400">현황 요약</span>
                    </div>
                    <div className="space-y-3">
                        {reminders.map((item, idx) => (
                            <div key={`briefing-${idx}`} className={`flex items-start gap-3 rounded-xl border ${toneStyles[item.tone]} p-3`}>
                                <div className={`p-2 rounded-lg ${toneStyles[item.tone]} shadow-inner border`}>
                                    <Icon name={item.icon} className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-800">{item.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}