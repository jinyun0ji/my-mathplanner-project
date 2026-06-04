import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../utils/helpers';
import ClassSelectionPanel from '../components/Shared/ClassSelectionPanel';
import FullGradeTable from '../components/Grade/FullGradeTable';
import TestResultTable from '../components/Grade/TestResultTable';
import TestStatisticsTable from '../components/Grade/TestStatisticsTable';
import { TestFormModal } from '../utils/modals/TestFormModal';
import { getClassAverages, getClassTests, getTestStatistics } from '../domain/grade/grade.service';
import { getDefaultClassId } from '../utils/classStatus';
import { useClassStudents } from '../utils/useClassStudents';
import { filterRosterByWithdrawDate } from '../utils/rosterFilter';
import { buildStudentParentPhoneLast4Map, formatStudentNameWithParentLast4 } from '../utils/parentPhone';
import GradePrintDocument from '../components/Grade/GradePrintDocument';
import { getTotalScore } from '../domain/grade/grade.service';


function useReactToPrint({ content, documentTitle, removeAfterPrint, onBeforeGetContent }) {
    return useCallback(() => {
        if (typeof onBeforeGetContent === 'function') onBeforeGetContent();

        const node = typeof content === 'function' ? content() : null;
        if (!node) {
            throw new Error('There is nothing to print');
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const printWindow = iframe.contentWindow;
        const printDoc = printWindow?.document;
        if (!printDoc || !printWindow) {
            if (removeAfterPrint) document.body.removeChild(iframe);
            throw new Error('PRINT_WINDOW_UNAVAILABLE');
        }

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map((el) => el.outerHTML)
            .join('');

        printDoc.open();
        printDoc.write(`<!doctype html><html><head><title>${documentTitle || 'print'}</title>${styles}</head><body>${node.outerHTML}</body></html>`);
        printDoc.close();

        const runPrint = () => {
            printWindow.focus();
            printWindow.print();
            if (removeAfterPrint) {
                setTimeout(() => {
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                }, 300);
            }
        };

        if (printDoc.readyState === 'complete') {
            runPrint();
        } else {
            iframe.onload = runPrint;
        }
    }, [content, documentTitle, onBeforeGetContent, removeAfterPrint]);
}


const asNumber = (value) => (Number.isFinite(value) ? value : Number(value));

const formatDateText = (value) => {
    if (!value) return '-';
    const candidate = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(candidate.getTime())) return String(value);
    return candidate.toISOString().slice(0, 10);
};

const calculateMedian = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const calculateStdDev = (values) => {
    if (!values.length) return null;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
    return Math.sqrt(variance);
};

const isCorrectForPrint = (value) => (
    value === true || value === 1 || value === '1' || value === 'O' || value === 'o' || value === '맞음' || value === '고침'
);

function buildRawScoreBins(scores = [], maxScore, binCount = 10) {
    const max = Number(maxScore);
    if (!Number.isFinite(max) || max <= 0) return { bins: [] };

    const step = max / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => {
        const start = index * step;
        const end = index === binCount - 1 ? max : (index + 1) * step;
        return {
            label: `${Math.round(start * 10) / 10}–${Math.round(end * 10) / 10}`,
            count: 0,
        };
    });

    scores.forEach((score) => {
        const raw = Number(score);
        if (!Number.isFinite(raw)) return;
        const idx = Math.min(binCount - 1, Math.max(0, Math.floor(raw / step)));
        bins[idx].count += 1;
    });

    return { bins };
}

function buildQuestionStats(rows = [], totalQuestions = 0) {
    const questionCount = Number(totalQuestions) || 0;
    if (questionCount <= 0) return [];

    const total = rows.length;
    return Array.from({ length: questionCount }, (_, offset) => {
        const q = offset + 1;
        const correct = rows.reduce((count, row) => {
            const value = row.answerMap?.[q] ?? row.answerMap?.[String(q)];
            return count + (isCorrectForPrint(value) ? 1 : 0);
        }, 0);

        return {
            q,
            correct,
            total,
            rate: total > 0 ? (correct / total) * 100 : 0,
        };
    });
}

// ----------------------------------------------------------------------
// 메인 컴포넌트: GradeManagement
// ----------------------------------------------------------------------
export default function GradeManagement({
    classes, tests, grades, handleSaveTest, handleDeleteTest,
    handleUpdateGrade, handleSaveClass, calculateClassSessions,
    closures = [],
    students = [],
    parents = [],
}) {
    const [selectedClassId, setSelectedClassId] = useState(() => getDefaultClassId(classes));
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testToEdit, setTestToEdit] = useState(null);
    const [selectedTestId, setSelectedTestId] = useState(null);
    const [isGradeInputModalOpen, setIsGradeInputModalOpen] = useState(false);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [compactPrint, setCompactPrint] = useState(true);
    const { students: classStudents, isLoading: isLoadingStudents } = useClassStudents(selectedClassId);

    // 엑셀 파일 입력을 위한 Ref
    const fileInputRef = useRef(null);
    const printRef = useRef(null);

    const selectedClass = classes.find(c => String(c.id) === String(selectedClassId));

    const parentLast4Map = useMemo(
        () => buildStudentParentPhoneLast4Map(students, parents),
        [students, parents],
    );

    useEffect(() => {
        if (!classes || classes.length === 0) return;
        if (selectedClassId && classes.some(c => String(c.id) === String(selectedClassId))) return;
        setSelectedClassId(getDefaultClassId(classes));
    }, [classes, selectedClassId]);

    const handleCloseGradeInput = useCallback(() => {
        setIsGradeInputModalOpen(false);
    }, []);

    // ------------------------------------------
    // 데이터 가공 (useMemo)
    // ------------------------------------------

    const classTests = useMemo(
        () => getClassTests(tests, selectedClassId),
        [tests, selectedClassId]
    );

    const selectedTest = useMemo(() => {
        return tests.find(t => t.id === selectedTestId);
    }, [tests, selectedTestId]);

    const rosterForTest = useMemo(
        () => filterRosterByWithdrawDate(classStudents, selectedClassId, selectedTest?.date),
        [classStudents, selectedClassId, selectedTest?.date]
    );

    const displayClassStudents = useMemo(() => classStudents.map((student) => ({
        ...student,
        name: formatStudentNameWithParentLast4(student, parentLast4Map),
    })), [classStudents, parentLast4Map]);

    const displayRosterForTest = useMemo(() => rosterForTest.map((student) => ({
        ...student,
        name: formatStudentNameWithParentLast4(student, parentLast4Map),
    })), [rosterForTest, parentLast4Map]);

    const classAverages = useMemo(
        () => getClassAverages(classTests, displayClassStudents, grades),
        [classTests, displayClassStudents, grades]
    );

    const testStatistics = useMemo(
        () => getTestStatistics(classTests, displayClassStudents, grades, classAverages),
        [classTests, displayClassStudents, grades, classAverages]
    );

    const printPayload = useMemo(() => {
        if (!selectedTest) {
            return {
                classNameText: selectedClass?.name || '-',
                testTitle: '-',
                testDateText: '-',
                stats: { count: 0, avg: null, median: null, stddev: null, top5: [], bottom5: [] },
                chart: { bins: [] },
                questionStats: [],
            };
        }

        const attemptedRows = (displayRosterForTest || []).map((student) => {
            const grade = grades?.[student.id]?.[selectedTest.id] || null;
            const score = grade ? getTotalScore(grade, selectedTest) : null;
            const noShow = String(grade?.score || '').trim() === '미응시';
            const attempted = Boolean(grade?.attempted === true || Number.isFinite(score)) && !noShow;
            const answerMap = grade?.answers || grade?.correctCount || {};

            return {
                studentId: student.id,
                studentName: student.name,
                score: Number.isFinite(score) ? Number(score) : null,
                attempted,
                answerMap,
            };
        }).filter((row) => row.attempted && Number.isFinite(row.score));

        const scores = attemptedRows.map((row) => row.score);
        const ordered = [...attemptedRows].sort((a, b) => b.score - a.score);

        return {
            classNameText: selectedClass?.name || '-',
            testTitle: selectedTest?.name || selectedTest?.title || '-',
            testDateText: formatDateText(selectedTest?.date || selectedTest?.createdAt || selectedTest?.updatedAt),
            stats: {
                count: attemptedRows.length,
                avg: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
                median: calculateMedian(scores),
                stddev: calculateStdDev(scores),
                top5: ordered.slice(0, 5).map((row) => ({ name: row.studentName, score: row.score })),
                bottom5: [...ordered].reverse().slice(0, 5).map((row) => ({ name: row.studentName, score: row.score })),
            },
            chart: buildRawScoreBins(scores, asNumber(selectedTest?.maxScore), 10),
            questionStats: buildQuestionStats(
                attemptedRows,
                Number(selectedTest?.totalQuestions) || (Array.isArray(selectedTest?.questionScores) ? selectedTest.questionScores.length : 0),
            ),
        };
    }, [displayRosterForTest, grades, selectedClass?.name, selectedTest]);

    useEffect(() => {
        setSelectedTestId(null);
    }, [selectedClassId]);

    // ------------------------------------------
    // 핸들러 함수들
    // ------------------------------------------

    const handleNewTest = () => {
        setTestToEdit(null);
        setIsTestModalOpen(true);
    };

    const handleEditTest = (test) => {
        setTestToEdit(test);
        setIsTestModalOpen(true);
    };

    const handleCloseTestModal = () => {
        setIsTestModalOpen(false);
        setTestToEdit(null);
    };

    const handleOpenGradeInput = () => {
        if (selectedTestId) {
            setIsGradeInputModalOpen(true);
        }
    };

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: selectedTest?.name ? `${selectedTest.name}-시험결과` : '시험결과',
        removeAfterPrint: true,
        onBeforeGetContent: () => {
            if (!printRef.current) {
                console.warn('[print] ref is null - nothing to print');
                throw new Error('PRINT_REF_NULL');
            }
        },
    });

    const handlePrintClick = useCallback(() => {
        const run = () => {
            if (!printRef.current) {
                alert('인쇄할 내용이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
                return;
            }
            try {
                handlePrint();
            } catch (error) {
                console.warn('[print] blocked', error);
            }
        };

        requestAnimationFrame(() => requestAnimationFrame(run));
    }, [handlePrint]);

    // 엑셀 양식 다운로드
    const handleDownloadExcelForm = (e) => {
        if (!selectedTest || !selectedClass) {
            alert("클래스와 시험을 선택해주세요.");
            return;
        }
        e.stopPropagation();

        const test = selectedTest;
        const studentsInClass = displayRosterForTest;

        const headers = ['학생명', ...Array.from({ length: test.totalQuestions }, (_, i) => `Q${i + 1} (${test.questionScores[i] || 0}점)`)];
        const sampleData = ['김철수 (예시)', ...Array(test.totalQuestions).fill('1')];

        const csvContent = [
            headers.join(','),
            '// --- 입력 규칙: 1 (맞음), 2 (틀림) / 미응시 학생은 점수 칸을 비워두세요 ---',
            sampleData.join(','),
            ...studentsInClass.map(student => [student.name, ...Array(test.totalQuestions).fill('')].join(','))
        ].join('\n');

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${test.name}_채점양식.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleUploadExcel = (e) => {
        if (!selectedTest) {
            alert("시험을 선택해주세요.");
            return;
        }
        e.stopPropagation();
        fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
                alert('CSV 또는 XLSX 파일만 업로드할 수 있습니다.');
                event.target.value = '';
                return;
            }
            console.log('File selected:', file.name);
            alert(`[시뮬레이션] '${file.name}' 파일을 읽었습니다.\n\n실제 구현 시:\n1. 파일을 파싱하여 학생별/문항별 점수 데이터를 추출합니다.\n2. handleUpdateGrade를 반복 호출하여 일괄 저장합니다.\n\n(현재는 시뮬레이션 메시지만 표시됩니다.)`);
            event.target.value = '';
        }
    };

    // ------------------------------------------
    // UI 서브 컴포넌트
    // ------------------------------------------

    const testPanelContent = useMemo(() => {
        return (
            <div className="max-h-72 overflow-y-auto pr-2">
                {classTests.map(test => (
                    <div
                        key={test.id}
                        onClick={() => setSelectedTestId(test.id)}
                        // [색상 변경] 선택 시: bg-[#f1f4ff] border-[#cfd8ff] (Navy Theme)
                        className={`p-3 mb-2 rounded-lg cursor-pointer border transition duration-150 ${
                            test.id === selectedTestId
                                ? 'bg-[#f1f4ff] border-[#cfd8ff] shadow-sm'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className={`text-sm font-bold ${test.id === selectedTestId ? 'text-[#334a91]' : 'text-gray-800'}`}>
                                    {test.name}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">{test.date} | 총점 {test.maxScore}점</p>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleEditTest(test); }}
                                className="text-xs font-medium text-[#334a91] hover:text-[#334a91] border border-[#eef2ff] bg-[#f1f4ff] rounded px-2 py-1"
                            >
                                수정
                            </button>
                        </div>
                    </div>
                ))}
                {classTests.length === 0 && <p className="text-sm text-gray-500 mt-2">등록된 시험이 없습니다.</p>}
                {isLoadingStudents && (
                    <p className="text-xs text-gray-400 mt-2">학생 목록을 불러오는 중입니다...</p>
                )}
            </div>
        );
    }, [classTests, selectedTestId]);

    const TestActionPanel = ({ test }) => {
        if (!test) return null;

        const questionScoresString = test.questionScores.map((score, index) =>
            `${index + 1}번: ${score}점`
        );

        return (
            // [색상 변경] border-l-4 border-[#334a91] (Navy Theme)
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-[#334a91] space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between border-b pb-3">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center leading-snug">
                        {/* [색상 변경] 아이콘: text-[#334a91] */}
                        <Icon name="fileText" className="w-5 h-5 mr-2 text-[#334a91]"/>
                        선택 시험 정보: {test.name}
                    </h3>
                    <p className="text-xs text-gray-500">상단 바에서 채점/엑셀 작업을 진행할 수 있습니다.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <p><span className="font-medium text-gray-600">시험일:</span> {test.date}</p>
                    <p><span className="font-medium text-gray-600">총점:</span> {test.maxScore}점</p>
                    <p><span className="font-medium text-gray-600">총 문항 수:</span> {test.totalQuestions}개</p>
                </div>

                <p className="text-sm border-t pt-3 text-gray-700">
                    <span className="font-medium text-gray-600 block mb-2">문항당 배점:</span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {questionScoresString.map((item, index) => (
                             <span key={index} className='bg-gray-50 px-1 rounded text-gray-600 border border-gray-100'>{item}</span>
                        ))}
                    </span>
                </p>

                <div className="flex flex-wrap gap-3 border-t pt-3">
                    {/* [색상 변경] 텍스트 버튼: 회색 -> 호버시 남색 */}
                     <button
                        onClick={() => handleEditTest(test)}
                        className="text-gray-500 hover:text-[#334a91] flex items-center text-sm font-medium transition"
                    >
                        <Icon name="edit" className="w-4 h-4 mr-1" />시험 정보 수정
                    </button>
                     <button
                        onClick={() => { if(window.confirm(`${test.name} 시험을 삭제하면 모든 학생의 성적 데이터도 삭제됩니다. 정말 삭제하시겠습니까?`)) handleDeleteTest(test.id); }}
                        className="text-gray-500 hover:text-red-600 flex items-center text-sm font-medium transition"
                    >
                        <Icon name="trash" className="w-4 h-4 mr-1" />시험 삭제
                    </button>
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-4 h-full">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Icon name="calendar" className="w-5 h-5 text-[#334a91]" />
                        <p>{selectedClass?.name || '클래스 미선택'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span>{selectedTest?.name || '시험 미선택'}</span>
                        {selectedTest?.date && <span className="text-gray-400">| {selectedTest.date}</span>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end w-full lg:w-auto">
                    <button
                        onClick={handleNewTest}
                        disabled={!selectedClassId}
                        className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
                    >
                        <Icon name="plus" className="w-4 h-4 mr-2" />
                        새 시험 등록
                    </button>
                    {selectedTest && (
                        <>
                            <button
                                onClick={handleDownloadExcelForm}
                                className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                <Icon name="file-text" className="w-4 h-4 mr-2" />
                                엑셀 양식
                            </button>
                            <button
                                onClick={handleUploadExcel}
                                className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-[#334a91] text-[#334a91] hover:bg-[#f1f4ff]"
                            >
                                <Icon name="upload" className="w-4 h-4 mr-2" />
                                엑셀로 결과 입력
                            </button>
                            <button
                                onClick={handleOpenGradeInput}
                                className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-[#455fab] text-white hover:bg-[#3b5198] shadow"
                            >
                                <Icon name="edit" className="w-4 h-4 mr-2" />
                                성적 입력/채점
                            </button>
                            <button
                                onClick={() => setIsStatsModalOpen(true)}
                                className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                통계 출력
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
                <div className="space-y-4">
                    <ClassSelectionPanel
                        classes={classes}
                        selectedClassId={selectedClassId}
                        setSelectedClassId={setSelectedClassId}
                        handleClassSave={handleSaveClass}
                        calculateClassSessions={calculateClassSessions}
                        showSessions={false}
                        showEditButton={true}
                    />
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
                        <div className='flex justify-between items-center border-b pb-2'>
                            <h4 className="text-lg font-bold text-gray-800">시험 목록 (클릭 시 채점)</h4>
                        </div>
                        {testPanelContent}
                    </div>
                </div>

                <div className="space-y-4">
                    {selectedClassId === null ? (
                        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                            <p className="text-gray-500">클래스를 선택하세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {selectedTestId ? (
                                <>
                                    {/* 1. 선택 시험 정보 패널 */}
                                    <TestActionPanel test={selectedTest} />

                                    {/* 2. 시험 통계 테이블 */}
                                    <TestStatisticsTable
                                        test={selectedTest}
                                        stats={testStatistics[selectedTestId]}
                                        currentStudents={displayRosterForTest}
                                    />
                                </>
                            ) : (
                                /* 선택된 시험이 없을 때 (전체 성적 테이블) 표시 */
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-[#334a91]">
                                        <h3 className="text-lg font-bold text-gray-800">{selectedClass.name} 성적 현황</h3>
                                        <p className="text-sm text-gray-600 mt-1">총 {classTests.length}개의 시험이 등록되어 있습니다. 성적 입력은 **시험 목록에서 시험을 선택**하여 진행하세요.</p>
                                    </div>
                                    <FullGradeTable
                                        classStudents={displayClassStudents}
                                        classTests={classTests}
                                        grades={grades}
                                        classAverages={classAverages}
                                        selectedClassId={selectedClassId}
                                    />
                                </div>
                                )}
                        </div>
                    )}
                </div>
            </div>

            {/* 시험 등록/수정 모달 */}
            <TestFormModal
                isOpen={isTestModalOpen}
                onClose={handleCloseTestModal}
                onSave={handleSaveTest}
                onReset={() => setTestToEdit(null)}
                classId={selectedClassId}
                test={testToEdit}
                classes={classes}
                calculateClassSessions={calculateClassSessions}
                closures={closures}
            />

            {/* 성적 입력 모달 */}
            {selectedTest && (
                <TestResultTable
                    isOpen={isGradeInputModalOpen}
                    onClose={handleCloseGradeInput}
                    test={selectedTest}
                    studentsData={displayRosterForTest}
                    handleUpdateGrade={handleUpdateGrade}
                    grades={grades}
                    closures={closures}
                    classId={selectedClassId || selectedTest?.classId}
                />
            )}

            {selectedTest && isStatsModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setIsStatsModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-[1400px] max-h-[95vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">{selectedTest.name} 시험결과 인쇄</h3>
                            <div className="flex gap-2 print-modal-actions">
                               <label className="flex items-center gap-1 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={compactPrint}
                                        onChange={(event) => setCompactPrint(event.target.checked)}
                                    />
                                    축소 인쇄
                                </label>
                                <button className="px-3 py-1.5 text-sm border rounded" onClick={handlePrintClick}>인쇄</button>
                                <button className="px-3 py-1.5 text-sm border rounded" onClick={() => setIsStatsModalOpen(false)}>닫기</button>
                            </div>
                        </div>
                        <div className="mt-3 border rounded-lg p-2 bg-white overflow-auto" style={{ maxHeight: '75vh' }}>
                            <GradePrintDocument
                                ref={printRef}
                                classNameText={printPayload.classNameText}
                                testTitle={printPayload.testTitle}
                                testDateText={printPayload.testDateText}
                                stats={printPayload.stats}
                                chart={printPayload.chart}
                                questionStats={printPayload.questionStats}
                                printScale={compactPrint ? 0.92 : 1}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 엑셀 파일 업로드 Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                style={{ display: 'none' }}
            />
        </div>
    );
};
