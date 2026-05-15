import React from 'react';
import { formatClassScheduleKo } from '../../utils/helpers';

const emptyValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const firstValue = (...values) => values.find((value) => value !== null && value !== undefined && value !== '') || '';

const getParentName = (parent, accountInfo) => firstValue(
  accountInfo?.parentName,
  parent?.name,
  parent?.parentName,
  parent?.displayName,
  parent?.guardianName,
);

const getParentPhone = (parent, accountInfo) => firstValue(
  accountInfo?.parentPhone,
  parent?.phone,
  parent?.parentPhone,
  parent?.mobile,
  parent?.contact,
  parent?.guardianPhone,
);

const getParentEmail = (parent, accountInfo) => firstValue(
  accountInfo?.parentEmail,
  parent?.email,
  parent?.googleEmail,
  parent?.loginEmail,
);

const getClassName = (classItem) => firstValue(classItem?.name, classItem?.title, classItem?.className, classItem?.subject, '클래스명 미정');

const getClassTeacherName = (classItem) => firstValue(
  classItem?.teacherName,
  classItem?.teacher,
  classItem?.tutorName,
  classItem?.tutor,
  classItem?.instructorName,
  classItem?.instructor,
  '담당 선생님 미정',
);

const getClassTimeLabel = (classItem) => firstValue(
  classItem?.timeLabel,
  classItem?.scheduleLabel,
  classItem?.dayTime,
  classItem?.daysText,
  formatClassScheduleKo(classItem),
);

const AccountInfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0">
    <dt className="shrink-0 text-sm font-semibold text-gray-500">{label}</dt>
    <dd className="text-right text-sm font-medium text-gray-900 break-all">{emptyValue(value)}</dd>
  </div>
);

const ParentAccountPage = ({ activeChild, currentParent, accountInfo, myClasses = [], ongoingClasses = [] }) => {
  const classesToShow = (Array.isArray(ongoingClasses) && ongoingClasses.length > 0)
    ? ongoingClasses
    : (Array.isArray(myClasses) ? myClasses.filter((classItem) => {
      const status = String(classItem?.status || classItem?.classStatus || '').trim();
      return !['종강', '종료', '퇴원', 'closed', 'finished', 'withdrawn'].includes(status);
    }) : []);

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold text-gray-900">학부모 정보</h3>
        <dl>
          <AccountInfoRow label="이름" value={getParentName(currentParent, accountInfo)} />
          <AccountInfoRow label="구글 이메일" value={getParentEmail(currentParent, accountInfo)} />
          <AccountInfoRow label="전화번호" value={getParentPhone(currentParent, accountInfo)} />
        </dl>
      </article>

      <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold text-gray-900">학생 정보</h3>
        <dl>
          <AccountInfoRow label="이름" value={activeChild?.name} />
          <AccountInfoRow label="전화번호" value={activeChild?.phone} />
          <AccountInfoRow label="학교" value={activeChild?.school} />
          <AccountInfoRow label="학년" value={activeChild?.grade} />
        </dl>
      </article>

      <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-900">현재 수강 클래스</h3>
        {classesToShow.length > 0 ? (
          <div className="space-y-2">
            {classesToShow.map((classItem, index) => (
              <div key={classItem?.id || classItem?.classId || `${getClassName(classItem)}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-sm font-semibold text-gray-900">{getClassName(classItem)}</p>
                <p className="mt-1 text-xs text-gray-500">담당: {getClassTeacherName(classItem)}</p>
                <p className="mt-1 text-xs text-gray-500">요일/시간: {emptyValue(getClassTimeLabel(classItem))}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
            현재 수강 중인 클래스가 없습니다.
          </p>
        )}
      </article>
    </section>
  );
};

export default ParentAccountPage;