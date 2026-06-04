import React, { useMemo, useState, useEffect } from 'react';
import HomeworkTab from './HomeworkTab';
import GradesTab from './GradesTab';
import ClinicTab from './ClinicTab';
import LessonReportList from '../../Shared/LessonReportList';

const normalizeId = (value) => String(value || '').trim();

const getItemClassId = (item) => normalizeId(
    item?.classId
    || item?.classDocId
    || item?.classID
    || item?.class?.id
    || item?.class?.classId
    || item?.class?.docId
    || item?.classRef
    || '',
);

const buildClassNameMap = (classes = []) => new Map(
    (Array.isArray(classes) ? classes : [])
        .filter((classItem) => classItem?.id)
        .map((classItem) => [normalizeId(classItem.id), classItem?.name || classItem?.title || normalizeId(classItem.id)]),
);

const filterByClass = (items = [], classFilter) => {
    if (classFilter === 'all') return items;
    return (Array.isArray(items) ? items : []).filter((item) => getItemClassId(item) === classFilter);
};

export default function LearningTab({
    studentId,
    myHomeworkStats,
    myGradeComparison,
    clinicLogs,
    students,
    classes,
    visibleClasses = null,
    lessonReports = [],
    initialTab = 'homework',
    isParent = false,
    compactHeader = true,
}) {
    const [learningMode, setLearningMode] = useState(initialTab === 'clinic' ? 'clinic' : 'regular');
    const [subTab, setSubTab] = useState(initialTab === 'clinic' ? 'homework' : initialTab);
    const [classFilter, setClassFilter] = useState('all');

    useEffect(() => {
        if (initialTab === 'clinic') {
            setLearningMode('clinic');
            return;
        }
        setLearningMode('regular');
        setSubTab(initialTab || 'homework');
    }, [initialTab]);

    const classNameMap = useMemo(() => buildClassNameMap(classes), [classes]);
    const stableVisibleClasses = useMemo(() => (Array.isArray(visibleClasses) ? visibleClasses : classes), [classes, visibleClasses]);
    const classOptions = useMemo(() => {
        const optionMap = new Map();
        (Array.isArray(stableVisibleClasses) ? stableVisibleClasses : []).forEach((classItem) => {
            const classId = normalizeId(classItem?.id || classItem?.classId || classItem?.classDocId || classItem?.docId);
            if (!classId || optionMap.has(classId)) return;
            optionMap.set(classId, classItem?.name || classItem?.title || classNameMap.get(classId) || classId);
        });
        [...(myHomeworkStats || []), ...(myGradeComparison || []), ...(lessonReports || [])].forEach((item) => {
            const classId = getItemClassId(item);
            if (!classId || optionMap.has(classId)) return;
            optionMap.set(classId, classNameMap.get(classId) || item?.className || item?.classTitle || classId);
        });
        return [{ id: 'all', name: '전체 클래스' }, ...Array.from(optionMap, ([id, name]) => ({ id, name }))];
    }, [classNameMap, lessonReports, myGradeComparison, myHomeworkStats, stableVisibleClasses]);

    useEffect(() => {
        if (classFilter !== 'all' && !classOptions.some((option) => option.id === classFilter)) {
            setClassFilter('all');
        }
    }, [classFilter, classOptions]);

    const filteredHomeworkStats = useMemo(() => filterByClass(myHomeworkStats, classFilter), [classFilter, myHomeworkStats]);
    const filteredGradeComparison = useMemo(() => filterByClass(myGradeComparison, classFilter), [classFilter, myGradeComparison]);
    const filteredLessonReports = useMemo(() => filterByClass(lessonReports, classFilter), [classFilter, lessonReports]);

    const regularTabs = [
        { id: 'homework', label: '과제' },
        { id: 'grades', label: '성적' },
        { id: 'attendance', label: '출결' },
        { id: 'reports', label: '학습리포트' },
    ];

    const activeRegularTab = subTab === 'clinic' ? 'homework' : subTab;

    return (
        <div className="animate-fade-in-up h-full flex flex-col pb-24 space-y-3">
            {!compactHeader && <h2 className="text-base font-bold text-gray-900 px-1">학습 관리</h2>}

            <section className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'regular', label: '정규 수업' },
                        { id: 'clinic', label: '클리닉' },
                    ].map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            onClick={() => setLearningMode(mode.id)}
                            className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                                learningMode === mode.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
            </section>

            {learningMode === 'regular' && (
                <>
                    <section className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
                        <label className="block text-xs font-semibold text-gray-500 mb-2">클래스 필터</label>
                        <select
                            value={classFilter}
                            onChange={(event) => setClassFilter(event.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                            {classOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.name}</option>
                            ))}
                        </select>
                    </section>

                    <section className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
                        <div className="grid grid-cols-4 gap-2">
                            {regularTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setSubTab(tab.id)}
                                    className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors ${
                                        activeRegularTab === tab.id
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    <div className="flex-1">
                        {activeRegularTab === 'homework' && <HomeworkTab myHomeworkStats={filteredHomeworkStats} />}
                        {activeRegularTab === 'grades' && <GradesTab myGradeComparison={filteredGradeComparison} />}
                        {activeRegularTab === 'attendance' && (
                            <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                                출결 상세는 클래스 화면에서 확인하세요.
                            </div>
                        )}
                        {activeRegularTab === 'reports' && <LessonReportList reports={filteredLessonReports} />}
                    </div>
                </>
            )}

            {learningMode === 'clinic' && (
                <div className="flex-1">
                    <ClinicTab studentId={studentId} clinicLogs={clinicLogs} students={students} classes={classes} isParent={isParent} />
                </div>
            )}
        </div>
    );
};
