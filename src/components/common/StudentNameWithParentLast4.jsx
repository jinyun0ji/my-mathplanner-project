// src/components/common/StudentNameWithParentLast4.jsx
import React, { useMemo } from 'react';
import { formatStudentNameWithParentLast4 } from '../../utils/parentPhone';

export default function StudentNameWithParentLast4({
  student,
  parentLast4Map,
  className = '',
  suffixClassName = '',
  fallback = '----',
}) {
  const text = useMemo(() => {
    return formatStudentNameWithParentLast4(student, parentLast4Map, fallback);
  }, [student, parentLast4Map, fallback]);

  const match = String(text).match(/^(.*)\s\((.*)\)$/);
  const name = match ? match[1] : (student?.name || '');
  const last4 = match ? match[2] : fallback;

  return (
    <span className={className}>
      {name}
      <span className={suffixClassName || 'text-xs font-normal text-gray-400 ml-1'}>
        ({last4 || fallback})
      </span>
    </span>
  );
}