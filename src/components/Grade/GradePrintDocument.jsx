import React, { forwardRef } from 'react';

const formatNumber = (value, digits = 1) => (
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits).replace(/\.0$/, '') : '-'
);

const ScoreDistribution = ({ scores = [], average = null, maxScore = null }) => {
  const ceiling = Math.max(Number(maxScore) || 0, ...scores, 1);
  const x = (score) => 34 + (Math.max(0, Math.min(ceiling, score)) / ceiling) * 532;
  const frequencies = [...scores.reduce((map, score) => map.set(score, (map.get(score) || 0) + 1), new Map())]
    .sort(([left], [right]) => left - right);
  const frequencyMode = scores.length > 20 || frequencies.some(([, count]) => count > 5);
  const lanesByScore = new Map();

  return <svg className="score-distribution" viewBox="0 0 600 102" role="img" aria-label={`전체 응시자의 실제 점수와 평균 위치 (${frequencyMode ? '점수별 인원' : '개별 응시자'} 표시)`}>
    <line x1="34" y1="67" x2="566" y2="67" className="distribution-axis" />
    {[0, ceiling / 2, ceiling].map((tick) => <g key={tick}>
      <line x1={x(tick)} y1="62" x2={x(tick)} y2="73" className="distribution-tick" />
      <text x={x(tick)} y="94" textAnchor="middle" className="distribution-label">{formatNumber(tick)}점</text>
    </g>)}
    {Number.isFinite(average) && <g>
      <line x1={x(average)} y1="19" x2={x(average)} y2="72" className="average-marker" />
      <text x={x(average)} y="13" textAnchor="middle" className="average-label">평균 {formatNumber(average)}점</text>
    </g>}
    {frequencyMode ? frequencies.map(([score, count]) => <g key={score} className="frequency-marker"><circle cx={x(score)} cy="54" r="4.5" className="student-marker" /><text x={x(score)} y="43" textAnchor="middle">{count}명</text></g>) : scores.map((score, index) => {
      const lane = lanesByScore.get(score) || 0;
      lanesByScore.set(score, lane + 1);
      return <circle key={`${score}-${index}`} cx={x(score)} cy={57 - (lane % 4) * 10} r="4" className="student-marker" />;
    })}
  </svg>;
};

const QuestionTable = ({ rows }) => <table className="report-table question-table">
  <colgroup><col className="question-number-column" /><col className="question-point-column" /><col className="question-correct-column" /><col className="question-rate-column" /></colgroup>
  <thead><tr><th>문항</th><th className="numeric">배점</th><th className="numeric">정답</th><th className="numeric">정답률</th></tr></thead>
  <tbody>{rows.map((row) => <tr key={row.question}><td>{row.question}</td><td className="numeric">{row.pointValue == null ? '-' : `${formatNumber(row.pointValue)}점`}</td><td className="numeric">{row.correctCount} / {row.submittedCount}</td><td><div className="rate-cell"><span>{formatNumber(row.correctRate)}%</span><span className="rate-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, row.correctRate || 0))}%` }} /></span></div></td></tr>)}</tbody>
</table>;

// Eight rows per column keeps each pair fragment-safe at the established 8.5pt body size.
const groupQuestions = (rows, groupSize = 16) => Array.from({ length: Math.ceil(rows.length / groupSize) }, (_, index) => {
  const group = rows.slice(index * groupSize, (index + 1) * groupSize);
  const splitAt = Math.ceil(group.length / 2);
  return [group.slice(0, splitAt), group.slice(splitAt)];
});

const GradePrintDocument = forwardRef(function GradePrintDocument({ classNameText, testTitle, testDateText, stats = {}, scores = [], rankings = [], questionStats = [], printScale = 1 }, ref) {
  const rates = questionStats.map((row) => row.correctRate).filter(Number.isFinite);
  const high = rates.length ? Math.max(...rates) : null;
  const low = rates.length ? Math.min(...rates) : null;
  const questionsAt = (rate) => questionStats.filter((row) => row.correctRate === rate).map((row) => `${row.question}번`).join(', ');

  return <article ref={ref} className="print-root grade-print-root" style={{ '--preview-scale': printScale }}>
    <style>{`
      @page { size: A4 portrait; margin: 13mm 14mm 15mm; }
      @media screen { .grade-print-root { transform: scale(var(--preview-scale)); transform-origin: top left; } }
      @media print { .print-root, .print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .grade-print-root { position: static !important; width: auto !important; min-height: 0 !important; transform: none !important; } }
      .grade-print-root { box-sizing: border-box; width: 182mm; min-height: 257mm; color: #172033; background: #fff; font-family: Pretendard, "Noto Sans KR", ui-sans-serif, system-ui, sans-serif; font-size: 9pt; line-height: 1.4; }
      .report-header { padding-bottom: 5mm; border-bottom: 1.4px solid #263b72; break-inside: avoid; page-break-inside: avoid; }
      .report-kicker { margin: 0 0 2mm; color: #455fab; font-size: 8pt; font-weight: 800; letter-spacing: .12em; }
      .report-title { margin: 0; font-size: 21pt; line-height: 1.2; letter-spacing: -.035em; }
      .report-meta { display: flex; gap: 5mm; margin: 2mm 0 0; color: #596273; font-size: 9pt; }
      .metric-strip { display: grid; grid-template-columns: repeat(4, 1fr); width: 78%; margin: 5mm auto; padding: 3mm 0; border-block: 1px solid #d9dee8; break-inside: avoid; page-break-inside: avoid; }
      .metric { padding: 0 3mm; border-left: 1px solid #e1e5ec; } .metric:first-child { border-left: 0; }
      .metric-label { display: block; margin-bottom: .7mm; color: #667085; font-size: 7.5pt; font-weight: 700; }
      .metric-value { font-size: 14pt; font-weight: 800; letter-spacing: -.02em; }
      .section { margin-top: 6mm; } .section-heading { margin: 0 0 3mm; padding-bottom: 2mm; border-bottom: 1px solid #d9dee8; color: #263b72; font-size: 12pt; font-weight: 800; break-after: avoid; page-break-after: avoid; }
      .section-note { margin: -2mm 0 2mm; color: #697386; font-size: 8pt; }
      .distribution-wrap { padding: 1mm 1mm 0; break-inside: avoid; page-break-inside: avoid; }
      .score-distribution { display: block; width: 100%; height: 27mm; overflow: visible; }
      .distribution-axis { stroke: #4e596b; stroke-width: 2; } .distribution-tick { stroke: #4e596b; stroke-width: 1.5; }
      .distribution-label { fill: #596273; font-size: 12px; font-weight: 600; } .student-marker { fill: #fff; stroke: #455fab; stroke-width: 2; }
      .average-marker { stroke: #172033; stroke-width: 1.5; stroke-dasharray: 4 3; } .average-label { fill: #172033; font-size: 11px; font-weight: 800; }
      .frequency-marker text { fill: #263b72; font-size: 10px; font-weight: 800; }
      .exam-summary { display: flex; flex-wrap: wrap; justify-content: center; gap: 2mm 7mm; margin: 1mm 0 0; color: #4e596b; font-size: 8.5pt; font-variant-numeric: tabular-nums; }
      .report-table { width: 100%; border-collapse: collapse; border-spacing: 0; } .report-table thead { display: table-header-group; }
      .report-table tr { break-inside: avoid; page-break-inside: avoid; } .report-table th { padding: 2mm 2.5mm; border-bottom: 1.2px solid #65718a; color: #4e596b; font-size: 7.5pt; font-weight: 800; text-align: left; }
      .report-table td { padding: 2mm 2.5mm; border-bottom: 1px solid #e1e5ec; font-size: 8.5pt; } .report-table th:first-child, .report-table td:first-child { text-align: center; }
      .report-table .numeric { text-align: right; font-variant-numeric: tabular-nums; } .rank-number { font-weight: 800; color: #263b72; } .empty-row { padding: 8mm !important; color: #7b8494; text-align: center !important; }
      .ranking-table { width: 76%; margin: 0 auto; table-layout: fixed; } .ranking-table th:nth-child(1) { width: 12%; } .ranking-table th:nth-child(2) { width: 46%; } .ranking-table th:nth-child(3) { width: 18%; } .ranking-table th:nth-child(4) { width: 24%; }
      .ranking-table th:nth-child(2), .ranking-table td:nth-child(2) { text-align: left; overflow-wrap: anywhere; }
      .question-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-bottom: 4mm; break-inside: avoid; page-break-inside: avoid; } .question-table { table-layout: fixed; }
      .question-number-column { width: 14%; } .question-point-column { width: 20%; } .question-correct-column { width: 27%; } .question-rate-column { width: 39%; }
      .rate-cell { display: grid; grid-template-columns: 3.5em 1fr; align-items: center; gap: 1.5mm; font-variant-numeric: tabular-nums; text-align: right; } .rate-track { height: 1.2mm; background: #e1e5ec; } .rate-track > span { display: block; height: 100%; background: #45546f; }
    `}</style>
    <header className="report-header"><p className="report-kicker">시험 결과 리포트</p><h1 className="report-title">{testTitle}</h1><p className="report-meta"><span>{classNameText}</span><span>시험일 {testDateText}</span></p></header>
    <section className="metric-strip" aria-label="시험 핵심 통계">{[['전체 응시자', `${stats.submittedCount ?? 0}명`], ['평균', `${formatNumber(stats.average)}점`], ['최고점', `${formatNumber(stats.maxScore)}점`], ['최저점', `${formatNumber(stats.minScore)}점`]].map(([label, value]) => <div className="metric" key={label}><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong></div>)}</section>
    <section className="section distribution-wrap"><h2 className="section-heading">성적 분포</h2><p className="section-note">{(scores.length > 20 || [...scores.reduce((map, score) => map.set(score, (map.get(score) || 0) + 1), new Map()).values()].some((count) => count > 5)) ? '실제 점수 위치별 응시 인원을 표시합니다.' : '점 하나가 응시자 한 명의 실제 원점수이며, 같은 점수는 세로로 나누어 표시합니다.'}</p><ScoreDistribution scores={scores} average={stats.average} maxScore={stats.possibleScore || stats.maxScore} />
      {rates.length > 0 && <p className="exam-summary"><span>평균 {formatNumber(stats.average)} / {formatNumber(stats.possibleScore)}점</span><span>가장 높은 정답률: {questionsAt(high)} ({formatNumber(high)}%)</span><span>가장 낮은 정답률: {questionsAt(low)} ({formatNumber(low)}%)</span></p>}
    </section>
    <section className="section ranking-section"><h2 className="section-heading">응시자 성적 순위</h2><table className="report-table ranking-table"><thead><tr><th>석차</th><th>학생</th><th className="numeric">점수</th><th className="numeric">평균 대비</th></tr></thead><tbody>{rankings.length ? rankings.map((row) => { const delta = row.score - stats.average; return <tr key={row.studentId}><td className="rank-number">{row.rank}</td><td>{row.studentName}</td><td className="numeric">{formatNumber(row.score)}</td><td className="numeric">{delta > 0 ? '+' : ''}{formatNumber(delta)}</td></tr>; }) : <tr><td colSpan="4" className="empty-row">응시 결과가 없습니다.</td></tr>}</tbody></table></section>
    {questionStats.length > 0 && <section className="section question-section"><h2 className="section-heading">문항별 분석</h2><p className="section-note">전체 응시자의 저장된 정오답 데이터를 기준으로 계산했습니다.</p><div className="question-groups">{groupQuestions(questionStats).map((columns, index) => <div className="question-pair" key={index}>{columns.map((rows, column) => rows.length ? <QuestionTable rows={rows} key={column} /> : null)}</div>)}</div></section>}
  </article>;
});

export default GradePrintDocument;
