import React, { useEffect, useState } from 'react';
import { Icon } from '../../utils/helpers';
import { createStaffUser, deactivateStaff, getStaffList } from '../../admin/staffService';
import useAuth from '../../auth/useAuth';

export default function StaffManagement() {
    const { user } = useAuth();
    const [staffEmail, setStaffEmail] = useState('');
    const [staffRole, setStaffRole] = useState('staff');
    const [staffStatus, setStaffStatus] = useState('');
    const [staffSubmitting, setStaffSubmitting] = useState(false);
    const [staffList, setStaffList] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffError, setStaffError] = useState('');
    const [staffActionStatus, setStaffActionStatus] = useState('');

    const loadStaffList = async () => {
        setStaffLoading(true);
        setStaffError('');

        try {
            const list = await getStaffList();
            setStaffList(Array.isArray(list) ? list : []);
        } catch (error) {
            setStaffError(error?.message || '직원 목록을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setStaffLoading(false);
        }
    };

    useEffect(() => {
        loadStaffList();
    }, []);

    const handleCreateStaffSubmit = async (event) => {
        event.preventDefault();

        setStaffStatus('');
        setStaffSubmitting(true);

        try {
            const result = await createStaffUser({ email: staffEmail, role: staffRole });
            const tempPasswordMessage = result?.tempPassword
                ? `임시 비밀번호: ${result.tempPassword}`
                : '임시 비밀번호는 계정 재설정으로 안내해주세요.';
            setStaffStatus(`계정을 생성했습니다. ${tempPasswordMessage}`);
            setStaffEmail('');
            setStaffRole('staff');
            await loadStaffList();
        } catch (error) {
            setStaffStatus(error?.message || '직원 생성 중 오류가 발생했습니다.');
        } finally {
            setStaffSubmitting(false);
        }
    };

    const handleDeactivateStaff = async (uid) => {
        if (!uid) return;
        if (!window.confirm('해당 직원 계정을 비활성화하시겠습니까?')) return;

        setStaffActionStatus('');

        try {
            await deactivateStaff({ uid });
            setStaffActionStatus('직원 계정을 비활성화했습니다.');
            setStaffList((prev) => prev.map((staff) => (
                staff.uid === uid ? { ...staff, active: false } : staff
            )));
        } catch (error) {
            setStaffActionStatus(error?.message || '직원 비활성화 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="space-y-6 lg:space-y-8 pb-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-5">
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
                            onChange={(event) => setStaffEmail(event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="staff@example.com"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-gray-600">역할</span>
                        <select
                            value={staffRole}
                            onChange={(event) => setStaffRole(event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="staff">직원</option>
                            <option value="admin">관리자</option>
                        </select>
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

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">직원 목록</p>
                        <p className="text-base font-bold text-gray-800">활성 상태 확인</p>
                    </div>
                    <button
                        type="button"
                        onClick={loadStaffList}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        <Icon name="refreshCw" className="w-3.5 h-3.5" />
                        새로고침
                    </button>
                </div>

                {staffActionStatus && <p className="text-sm text-gray-600">{staffActionStatus}</p>}
                {staffError && <p className="text-sm text-red-600">{staffError}</p>}

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">이름</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">이메일</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">역할</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">상태</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {staffLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">직원 목록을 불러오는 중...</td>
                                </tr>
                            ) : staffList.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">등록된 직원이 없습니다.</td>
                                </tr>
                            ) : (
                                staffList.map((staff) => {
                                    const isInactive = staff.active === false;
                                    const isSelf = staff.uid === user?.uid;

                                    return (
                                        <tr key={staff.uid} className={isInactive ? 'bg-gray-50' : undefined}>
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-800">{staff.displayName || '이름 없음'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{staff.email || '이메일 없음'}</td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-600">{staff.role === 'admin' ? '관리자' : '직원'}</td>
                                            <td className="px-4 py-3 text-center">
                                                {isInactive ? (
                                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">비활성화</span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">활성</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeactivateStaff(staff.uid)}
                                                    disabled={isInactive || isSelf}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Icon name="userX" className="w-3.5 h-3.5" />
                                                    {isSelf ? '본인 계정' : '비활성화'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}