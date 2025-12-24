import React, { useState } from 'react';
import { Icon } from '../../utils/helpers';
import { createStaffUser } from '../../admin/staffService';

export default function StaffManagement() {
    const [staffEmail, setStaffEmail] = useState('');
    const [staffRole, setStaffRole] = useState('staff');
    const [staffStatus, setStaffStatus] = useState('');
    const [staffSubmitting, setStaffSubmitting] = useState(false);

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
        } catch (error) {
            setStaffStatus(error?.message || '직원 생성 중 오류가 발생했습니다.');
        } finally {
            setStaffSubmitting(false);
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
        </div>
    );
}