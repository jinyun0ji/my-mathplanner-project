import React from 'react';

const digitsOnly = (v) => String(v || '').replace(/[^\d]/g, '');
const last4 = (v) => {
  const d = digitsOnly(v);
  return d ? d.slice(-4) : '';
};

export default function StudentNameWithParentLast4({
  student,
  parentLast4Map = {},
  fallback = '----',
  className = '',
  suffixClassName = 'text-[11px] text-gray-400 ml-1',
}) {
  const name = student?.name || '';
  const key = String(student?.id || '');
  const v = parentLast4Map?.[key] || '';
  const shown = v || fallback;

  return (
    <span className={className}>
      <span>{name}</span>
      <span className={suffixClassName}>({shown})</span>
    </span>
  );
}

// (필요 시) parentLast4Map 없이도 직접 phone으로 쓰는 곳이 있다면 이 함수로 대체 가능
export const phoneLast4 = (phone, fallback = '----') => last4(phone) || fallback;