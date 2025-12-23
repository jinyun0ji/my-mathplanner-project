import React from 'react';

const MODE_OPTIONS = [
  { value: 'none', label: '알림 안 보냄' },
  { value: 'immediate', label: '즉시 알림' },
  { value: 'scheduled', label: '예약 알림' },
];

export default function StaffNotificationFields({
  mode,
  onModeChange,
  title,
  onTitleChange,
  body,
  onBodyChange,
  scheduledAt,
  onScheduledAtChange,
}) {
  const showNotificationFields = mode !== 'none';

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
      <div>
        <label className="block text-sm font-medium text-gray-700">직원 알림 옵션</label>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          * 직원 알림은 직접 제목과 내용을 입력해야 합니다.
        </p>
      </div>

      {showNotificationFields && (
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">알림 제목*</label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              required={showNotificationFields}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              placeholder="예: 수업일지 업데이트 안내"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">알림 내용*</label>
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              required={showNotificationFields}
              rows="3"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              placeholder="예: 오늘 수업 내용을 확인해 주세요."
            />
          </div>
          {mode === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">예약 알림 시간*</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => onScheduledAtChange(e.target.value)}
                required={mode === 'scheduled'}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}