import {
  formatClassScheduleKo,
  getClassTimeOnDate,
  hasClassOnDate,
  isClosedForClass,
} from './helpers';

export const toLocalYmd = (dateInput = new Date()) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const y = safe.getFullYear();
  const m = String(safe.getMonth() + 1).padStart(2, '0');
  const d = String(safe.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getClassKeyCandidates = (cls = {}) => [
  cls?.id,
  cls?.classId,
  cls?.classDocId,
  cls?.docId,
  cls?.code,
  cls?.classCode,
  cls?.key,
].filter(Boolean).map(String);

export const isClassVisibleByIds = (cls, visibleClassIds = null) => {
  if (!Array.isArray(visibleClassIds) || visibleClassIds.length === 0) return true;
  const visible = new Set(visibleClassIds.map(String));
  return getClassKeyCandidates(cls).some((key) => visible.has(key));
};

export const getViewerDailyClassItems = ({
  classes = [],
  date = new Date(),
  dateStr = toLocalYmd(date),
  closures = [],
  visibleClassIds = null,
  isClassRetiredOnDate = null,
  includeClosed = false,
} = {}) => {
  const list = Array.isArray(classes) ? classes : [];
  return list
    .filter((cls) => {
      const classId = String(cls?.id || cls?.classId || cls?.classDocId || '');
      if (!classId) return false;
      if (!isClassVisibleByIds(cls, visibleClassIds)) return false;
      if (!hasClassOnDate(cls, dateStr)) return false;
      if (typeof isClassRetiredOnDate === 'function' && isClassRetiredOnDate(classId, date)) return false;
      if (!includeClosed && isClosedForClass(dateStr, classId, closures)) return false;
      return true;
    })
    .map((cls) => {
      const todayTime = getClassTimeOnDate(cls, dateStr);
      const startTime = String(todayTime || '').split('~')[0] || '99:99';
      return {
        type: 'class',
        classId: cls.id,
        classDocId: cls.id,
        classCode: cls.classId || cls.code || cls.classCode || cls.key || null,
        time: startTime,
        title: cls.name,
        name: cls.name,
        teacher: cls.teacher,
        sub: `${cls.teacher || '-'} 선생님`,
        timeLabel: todayTime,
        todayTime,
        scheduleLabel: formatClassScheduleKo(cls),
        date: dateStr,
        rawClass: cls,
      };
    })
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
};

export const getViewerTodayClassItems = (options = {}) => getViewerDailyClassItems(options);
