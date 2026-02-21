import React from 'react';
import { formatStudentNameWithParentLast4 } from '../../utils/parentPhone';

export default function StudentNameWithParentLast4({
  student,
  parentLast4Map,
  className = '',
  suffixClassName = 'text-xs font-normal text-gray-400 ml-1',
  fallback = '----',
}) {
  const text = formatStudentNameWithParentLast4(student, parentLast4Map, fallback);

  const match = text.match(/^(.*)\s\((.*)\)$/);
  if (!match) return <span className={className}>{text}</span>;

  const name = match[1];
  const last4 = match[2];

  return (
    <span className={className}>
      {name}
      <span className={suffixClassName}>({last4})</span>
    </span>
  );
}