import React, { useMemo } from 'react';
import { getTotalScore } from '../../domain/grade/grade.service';

const TOP_COUNT = 5;
const BOTTOM_COUNT = 5;

const asNumber = (value) => (Number.isFinite(value) ? value : Number(value) || 0);

const toPercent = (score, total) => {
    if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return null;
    return Math.round((score / total) * 100);
};

const buildHistogramByPercent = (scores, total, step = 10) => {
    const bins = [];
    for (let start = 0; start < 100; start += step) {
        const end = Math.min(100, start + step);
        bins.push({
            key: `${start}-${end}`,
            label: `${start}–${end}%`,
            start,
            end,
            count: 0,
        });
    }

    for (const score of scores) {
        const percent = toPercent(score, total);
        if (percent == null) continue;
        const index = percent === 100 ? bins.length - 1 : Math.floor(percent / step);
        if (bins[index]) bins[index].count += 1;
    }

    return bins;
};

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
    const width = 520;
    const height = 240;
    const chartLeft = 48;
    const chartRight = 10;
    const chartTop = 20;
    const chartBottom = 46;
    const plotWidth = width - chartLeft - chartRight;
    const plotHeight = height - chartTop - chartBottom;
    const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
    const barWidth = bins.length ? plotWidth / bins.length : plotWidth;

    return (
        <svg className="histogram-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="점수분포 그래프(인원수)">
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                const y = chartTop + (1 - step) * plotHeight;
                const value = Math.round(maxCount * step);
                return (
                    <g key={`tick-${step}`}>
                        <line x1={chartLeft} y1={y} x2={width - chartRight} y2={y} stroke="#d1d5db" strokeWidth="1" />
                        <text x={chartLeft - 8} y={y + 4} textAnchor="end" className="axis-text">{value}</text>
                    </g>
                );
            })}

            <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartTop + plotHeight} stroke="#111" strokeWidth="1.2" />
            <line x1={chartLeft} y1={chartTop + plotHeight} x2={width - chartRight} y2={chartTop + plotHeight} stroke="#111" strokeWidth="1.2" />
            
            {bins.map((bin, index) => {
                const barHeight = maxCount > 0 ? (bin.count / maxCount) * plotHeight : 0;
                const x = chartLeft + index * barWidth + 4;
                const y = chartTop + plotHeight - barHeight;
                const actualBarWidth = Math.max(10, barWidth - 8);
                return (
                    <g key={bin.key}>
                        <rect x={x} y={y} width={actualBarWidth} height={barHeight} fill="#455fab" opacity="0.92" />
                        <text x={x + (actualBarWidth / 2)} y={Math.max(chartTop + 12, y - 6)} textAnchor="middle" className="bar-count">
                            {bin.count}
                        </text>
                        <text x={x + (actualBarWidth / 2)} y={height - 18} textAnchor="middle" className="axis-text x-axis-label">
                            {bin.label}
                        </text>
                    </g>
                );
            })}
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
                const answerMap = grade?.answers || grade?.correctCount || {};

                return {
                    studentId: student.id,
                    studentName: student.name,
                    score,
                    attempted,
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
            bins: buildHistogramByPercent(scores, maxScore, 10),
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
        <div>
            <style>{`
                .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; font-size: 11px; margin-bottom: 10px; }
                .summary-card { border: 1px solid #d1d5db; border-radius: 4px; padding: 5px; }
                .histogram-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; margin-bottom: 10px; }
                .histogram-chart-wrap { width: 100%; min-height: 240px; }
                .histogram-svg { width: 100%; height: 240px; }
                .axis-text { font-size: 11px; fill: #111827; font-weight: 500; }
                .x-axis-label { font-size: 10.5px; }
                .bar-count { font-size: 12px; fill: #111827; font-weight: 700; }
                .rank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .rank-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 6px; min-height: 100px; }
                .rank-box ul { margin: 0; padding-left: 18px; font-size: 11px; line-height: 1.45; }
                .section-title { font-size: 13px; font-weight: 700; margin: 0 0 6px; color: #111827; }
            `}</style>

            <header>
                <h1 className="print-title">{classInfo?.name || '-'}</h1>
                <p className="print-subtitle">{test?.name || test?.title || '-'} · {resolvedDate}</p>
            </header>

            <div className={`grade-print-grid ${compact ? 'print-scale-tight' : ''}`}>
                <section className="grade-print-left avoid-break">
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

                <section className="grade-print-right avoid-break">
                    <h2 className="section-title">정오표(응시자)</h2>
                    <table className={`grade-print-table ${denseTableClass}`}>
                        <thead>
                            <tr>
                                <th>학생</th>
                                {Array.from({ length: prepared.totalQuestions }, (_, idx) => (
                                    <th key={`head-${idx + 1}`}>{idx + 1}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {prepared.attemptedRows.map((row) => (
                                <tr key={row.studentId}>
                                    <td>{row.studentName}</td>
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