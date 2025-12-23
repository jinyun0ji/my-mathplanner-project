import React from 'react';

export default function OnboardingPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center space-y-4">
                <h1 className="text-2xl font-bold text-gray-900">가입 승인 대기중</h1>
                <p className="text-gray-600">관리자가 역할을 배정하는 동안 잠시만 기다려 주세요.</p>
            </div>
        </div>
    );
}
