import React from 'react';

export default function AdminPlaceholder({ title, description }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">관리자 전용</p>
                <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
        </div>
    );
}