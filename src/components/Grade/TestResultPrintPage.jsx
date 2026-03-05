import React, { useMemo } from 'react';
import { getTotalScore } from '../../domain/grade/grade.service';

const TOP_COUNT = 5;
const BOTTOM_COUNT = 5;

const asNumber = (value) => (Number.isFinite(value) ? value : Number(value) || 0);

const formatScore = (score, maxScore) => {
    const parsedScore = asNumber(score);
    const parsedMax = asNumber(maxScore);
    if (parsedMax > 0) return `${parsedScore.toFixed(1)} / ${parsedMax}`;
    return `${parsedScore.toFixed(1)}`;
};

const normalizeAnswerStatus = (value) => {
    if (value === true || value === 1 || value === '1' || value === 'O' || value === 'o' || value === '맞음') return 'O';
    if (value === false || value === 2 || value === '2' || value === 'X' || value === 'x' || value === '틀림') return 'X';
    if (value === '고침' || value === '△' || value === '수정') return '△';
    return '';
};

const formatDate = (value) => {
    if (!value) return '-';
    const candidate = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(candidate.getTime())) return String(value);
    return candidate.toISOString().slice(0, 10);
};

const percentileBins = (attemptedRows) => {
    const bins = Array.from({ length: 10 }, (_, idx) => ({
        label: idx === 9 ? '90-100' : `${idx * 10}-${idx * 10 + 9}`,
        count: 0,
    }));

    attemptedRows.forEach((row) => {
        if (!Number.isFinite(row.percent)) return;
        const percent = Math.max(0, Math.min(100, row.percent));
        const binIndex = percent === 100 ? 9 : Math.floor(percent / 10);
        bins[binIndex].count += 1;
    });

    return bins;
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

function ScoreHistogram({ bins = [] }) {
    const svgHeight = 160;
    const innerWidth = 100;
    const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
    const barWidth = innerWidth / bins.length;

    return (
        <svg className="histogram-svg" viewBox={`0 0 ${innerWidth} ${svgHeight}`} preserveAspectRatio="none" role="img" aria-label="점수분포 그래프">
            {bins.map((bin, index) => {
                const barHeight = (bin.count / maxCount) * 110;
                const x = index * barWidth + 1;
                const y = 120 - barHeight;
                const showLabel = index % 2 === 0 || index === bins.length - 1;
                return (
                    <g key={bin.label}>
                        <rect x={x} y={y} width={barWidth - 2} height={barHeight} fill="#4f46e5" opacity="0.85" />
                        <text x={x + ((barWidth - 2) / 2)} y={118 - barHeight} textAnchor="middle" className="bar-count">{bin.count}</text>
                        {showLabel && (
                            <text x={x + ((barWidth - 2) / 2)} y={138} textAnchor="middle" className="bar-label">{bin.label}</text>
                        )}
                    </g>
                );
            })}
            <line x1="0" y1="121" x2="100" y2="121" stroke="#6b7280" strokeWidth="0.6" />
        </svg>
    );
}

export default function TestResultPrintPage({ classInfo, test, students = [], gradesMap = {}, compact = false }) {
    const resolvedDate = formatDate(test?.date || test?.createdAt || test?.updatedAt);

    const prepared = useMemo(() => {
        const maxScore = Number(test?.maxScore);

        const attemptedRows = students
            .map((student) => {
                const grade = gradesMap?.[student.id]?.[test?.id] || null;
                const score = grade ? getTotalScore(grade, test) : null;
                const isAttempted = grade && grade.attempted === true
                    ? true
                    : (Number.isFinite(score) || (Number.isFinite(grade?.score) && grade?.score !== null));

                const hasNoShowText = String(grade?.score || '').trim() === '미응시';
                const attempted = Boolean(isAttempted) && !hasNoShowText;

                const percent = attempted && Number.isFinite(maxScore) && maxScore > 0 && Number.isFinite(score)
                    ? (score / maxScore) * 100
                    : null;

                const answerMap = grade?.answers || grade?.correctCount || {};

                return {
                    studentId: student.id,
                    studentName: student.name,
                    score,
                    attempted,
                    percent,
                    answerMap,
                };
            })
            .filter((row) => row.attempted);

        const scores = attemptedRows
            .map((row) => row.score)
            .filter(Number.isFinite);

        const averageRawScore = scores.length
            ? scores.reduce((sum, value) => sum + value, 0) / scores.length
            : null;

        const orderedByScore = attemptedRows
            .filter((row) => Number.isFinite(row.score))
            .sort((a, b) => b.score - a.score);

        const maxQuestionFromAnswers = attemptedRows.reduce((max, row) => {
            const maxFromRow = Object.keys(row.answerMap || {}).reduce((innerMax, key) => {
                const numeric = Number(key);
                return Number.isFinite(numeric) ? Math.max(innerMax, numeric) : innerMax;
            }, 0);
            return Math.max(max, maxFromRow);
        }, 0);

        const totalQuestions = Number(test?.totalQuestions)
            || (Array.isArray(test?.questionScores) ? test.questionScores.length : 0)
            || maxQuestionFromAnswers;

        return {
            attemptedRows,
            bins: percentileBins(attemptedRows),
            averageRawScore,
            medianRawScore: calculateMedian(scores),
            stdDevRawScore: calculateStdDev(scores),
            topStudents: orderedByScore.slice(0, TOP_COUNT),
            bottomStudents: [...orderedByScore].reverse().slice(0, BOTTOM_COUNT),
            totalQuestions,
        };
    }, [gradesMap, students, test]);

    const denseTableClass = prepared.totalQuestions >= 40 ? 'dense' : '';

    return (
        <div className="print-page-wrap">
            <style>{`
                .print-page-wrap { font-family: 'Noto Sans KR', sans-serif; color: #111827; background: #fff; }
                .print-header { margin-bottom: 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; }
                .print-header .class-name { font-size: 20px; font-weight: 700; margin: 0; }
                .print-header .test-meta { font-size: 13px; margin-top: 4px; color: #374151; }
                .section-title { font-size: 13px; font-weight: 700; margin: 0 0 6px; }
                .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; font-size: 11px; margin-bottom: 10px; }
                .summary-card { border: 1px solid #d1d5db; border-radius: 4px; padding: 5px; }
                .histogram-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; margin-bottom: 10px; }
                .histogram-chart-wrap { width: 100%; height: 260px; }
                .histogram-svg { width: 100%; height: 100%; }
                .bar-label { font-size: 3.2px; fill: #374151; }
                .bar-count { font-size: 3.4px; fill: #111827; }
                .rank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .rank-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 6px; min-height: 100px; }
                .rank-box ul { margin: 0; padding-left: 18px; font-size: 11px; line-height: 1.45; }
                .answer-table-wrap { border: 1px solid #d1d5db; border-radius: 4px; padding: 6px; }
                .answer-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
                .answer-table.dense { font-size: 9px; }
                .answer-table thead { display: table-header-group; }
                .answer-table tr { page-break-inside: avoid; }
                .answer-table th, .answer-table td { border: 1px solid #d1d5db; padding: 2px 3px; text-align: center; }
                .answer-table th.student-col, .answer-table td.student-col { text-align: left; width: 82px; min-width: 82px; }
                .answer-table th.q-col { font-family: 'Courier New', monospace; width: 22px; min-width: 22px; }
            `}</style>

            <header className="print-header">
                <h1 className="class-name">{classInfo?.name || '-'}</h1>
                <p className="test-meta">{test?.name || test?.title || '-'} · {resolvedDate}</p>
            </header>

            <div className={`print-grid ${compact ? 'print-scale-tight' : 'print-scale'}`}>
                <section className="avoid-break">
                    <h2 className="section-title">시험 요약</h2>
                    <div className="summary-grid">
                        <div className="summary-card">응시자 수: <b>{prepared.attemptedRows.length}</b></div>
                        <div className="summary-card">평균: <b>{Number.isFinite(prepared.averageRawScore) ? formatScore(prepared.averageRawScore, test?.maxScore) : '-'}</b></div>
                        <div className="summary-card">중앙값: <b>{Number.isFinite(prepared.medianRawScore) ? formatScore(prepared.medianRawScore, test?.maxScore) : '-'}</b></div>
                        <div className="summary-card">표준편차(원점수): <b>{Number.isFinite(prepared.stdDevRawScore) ? prepared.stdDevRawScore.toFixed(1) : '-'}</b></div>
                    </div>

                    <div className="histogram-box avoid-break">
                        <h3 className="section-title">점수분포 그래프(%)</h3>
                        <div className="histogram-chart-wrap">
                            <ScoreHistogram bins={prepared.bins} />
                        </div>
                    </div>

                    <div className="rank-grid">
                        <div className="rank-box">
                            <h3 className="section-title">최고점 Top {TOP_COUNT}</h3>
                            <ul>
                                {prepared.topStudents.map((row, index) => (
                                    <li key={`${row.studentId}-top`}>{index + 1}. {row.studentName} ({formatScore(row.score, test?.maxScore)})</li>
                                ))}
                            </ul>
                        </div>
                        <div className="rank-box">
                            <h3 className="section-title">최저점 Bottom {BOTTOM_COUNT}</h3>
                            <ul>
                                {prepared.bottomStudents.map((row, index) => (
                                    <li key={`${row.studentId}-bottom`}>{index + 1}. {row.studentName} ({formatScore(row.score, test?.maxScore)})</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="answer-table-wrap no-print-scroll">
                    <h2 className="section-title">정오표(응시자)</h2>
                    <table className={`answer-table ${denseTableClass}`}>
                        <thead>
                            <tr>
                                <th className="student-col">학생</th>
                                {Array.from({ length: prepared.totalQuestions }, (_, idx) => (
                                    <th key={`head-${idx + 1}`} className="q-col">{idx + 1}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {prepared.attemptedRows.map((row) => (
                                <tr key={row.studentId}>
                                    <td className="student-col">{row.studentName}</td>
                                    {Array.from({ length: prepared.totalQuestions }, (_, idx) => {
                                        const key = String(idx + 1);
                                        return <td key={`${row.studentId}-${key}`}>{normalizeAnswerStatus(row.answerMap?.[key])}</td>;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>
        </div>
    );
}