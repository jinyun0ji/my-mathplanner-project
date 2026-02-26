import React, { useMemo } from 'react';
import { last4 } from '../../utils/parentPhone';

const pickParentPhoneFromStudentDoc = (s) => {
  if (!s) return '';
  return (
    s.parentPhone ||
    s.parentPhoneNumber ||
    s.parentMobile ||
    s.parentTel ||
    s.guardianPhone ||
    s.guardianPhoneNumber ||
    s.contactParentPhone ||
    s.contact?.parentPhone ||
    s.contact?.guardianPhone ||
    ''
  );
};

export default function StudentNameWithParentLast4({
  student,
  parentLast4Map = {},
  className = '',
  fallback = '----',
}) {
  const name = student?.name || '';

  const parentLast4 = useMemo(() => {
    const direct = last4(pickParentPhoneFromStudentDoc(student));
    const mapped = parentLast4Map[String(student?.id || '')] || '';
    return direct || mapped || fallback;
  }, [student, parentLast4Map, fallback]);

  return (
    <span className={className}>
      <span className="font-medium">{name}</span>
      <span className="ml-1 text-xs text-gray-400 font-normal">
        ({parentLast4})
      </span>
    </span>
  );
}