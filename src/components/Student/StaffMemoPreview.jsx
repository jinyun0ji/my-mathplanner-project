import React from 'react';

const formatDateTime = (value) => {
    if (!value) return '';
    if (typeof value?.toDate === 'function') {
        return value.toDate().toLocaleString('ko-KR');
    }
    if (value instanceof Date) {
        return value.toLocaleString('ko-KR');
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('ko-KR');
    }
    return String(value);
};

export default function StaffMemoPreview({ memos = [], limit = 3, onOpenAll }) {
    const previewItems = Array.isArray(memos) ? memos.slice(0, limit) : [];

    return (
        <div className="space-y-3">
            {previewItems.length > 0 ? (
                previewItems.map((memo) => (
                    <div key={memo.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">{memo.createdByName || '작성자 정보 없음'}</span>
                            <span>{formatDateTime(memo.createdAt)}</span>
                        </div>
                        <p className="mt-2 max-h-16 overflow-hidden text-sm text-gray-700">{memo.content}</p>
                    </div>
                ))
            ) : (
                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                    아직 등록된 직원 메모가 없습니다.
                </p>
            )}
            {typeof onOpenAll === 'function' && (
                <button
                    type="button"
                    onClick={onOpenAll}
                    disabled={!memos.length}
                    className="text-xs font-semibold text-[#455fab] hover:underline disabled:text-gray-300"
                >
                    전체보기
                </button>
            )}
        </div>
    );
}