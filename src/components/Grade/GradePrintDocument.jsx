import React, { forwardRef } from 'react';

const formatNumber = (value, digits = 1) => (
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits).replace(/\.0$/, '') : '-'
);

const ScoreDistribution = ({ scores = [], average = null, maxScore = null }) => {
  const ceiling = Math.max(Number(maxScore) || 0, ...scores, 1);
  const x = (score) => 28 + (Math.max(0, Math.min(ceiling, score)) / ceiling) * 544;
  const lanes = [62, 72, 82, 92];

  return (
    <svg className="score-distribution" viewBox="0 0 600 118" role="img" aria-label="전체 응시자의 실제 점수와 평균 위치">
      <line x1="28" y1="78" x2="572" y2="78" className="distribution-axis" />
      {[0, ceiling / 2, ceiling].map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} y1="74" x2={x(tick)} y2="83" className="distribution-axis" />
          <text x={x(tick)} y="105" textAnchor="middle" className="distribution-label">{formatNumber(tick)}</text>
        </g>
      ))}
      {Number.isFinite(average) && (
        <g>
          <line x1={x(average)} y1="21" x2={x(average)} y2="83" className="average-marker" />
          <text x={x(average)} y="14" textAnchor="middle" className="average-label">평균 {formatNumber(average)}</text>
        </g>
      )}
      {scores.map((score, index) => (
        <circle key={`${score}-${index}`} cx={x(score)} cy={lanes[index % lanes.length]} r="3.2" className="student-marker" />
      ))}
    </svg>
  );
};

const GradePrintDocument = forwardRef(function GradePrintDocument({
  classNameText,
  testTitle,
  testDateText,
  stats = {},
  scores = [],
  rankings = [],
  questionStats = [],
  printScale = 1,
}, ref) {
  return (
    <article ref={ref} className="print-root grade-print-root" style={{ '--preview-scale': printScale }}>
      <style>{`
        @page { size: A4 portrait; margin: 13mm 14mm 15mm; }
        @media screen { .grade-print-root { transform: scale(var(--preview-scale)); transform-origin: top left; } }
        @media print {
          .print-root, .print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .grade-print-root { width: auto !important; min-height: 0 !important; transform: none !important; }
        }
        .grade-print-root { box-sizing: border-box; width: 182mm; min-height: 257mm; color: #172033; background: #fff; font-family: Pretendard, "Noto Sans KR", ui-sans-serif, system-ui, sans-serif; font-size: 9.5pt; line-height: 1.45; }
        .report-header { padding-bottom: 7mm; border-bottom: 1.4px solid #263b72; break-inside: avoid; page-break-inside: avoid; }
        .report-kicker { margin: 0 0 2mm; color: #455fab; font-size: 8pt; font-weight: 800; letter-spacing: .12em; }
        .report-title { margin: 0; font-size: 22pt; line-height: 1.2; letter-spacing: -.035em; }
        .report-meta { display: flex; gap: 5mm; margin: 3mm 0 0; color: #596273; font-size: 9pt; }
        .metric-strip { display: grid; grid-template-columns: 1.25fr repeat(3, 1fr); margin: 7mm 0 8mm; padding: 4mm 0; border-top: 1px solid #d9dee8; border-bottom: 1px solid #d9dee8; break-inside: avoid; page-break-inside: avoid; }
        .metric { padding: 0 5mm; border-left: 1px solid #e1e5ec; }
        .metric:first-child { padding-left: 0; border-left: 0; }
        .metric-label { display: block; margin-bottom: 1mm; color: #667085; font-size: 7.5pt; font-weight: 700; }
        .metric-value { color: #172033; font-size: 15pt; font-weight: 800; letter-spacing: -.02em; }
        .section { margin-top: 8mm; }
        .section-heading { margin: 0 0 3mm; padding-bottom: 2mm; border-bottom: 1px solid #d9dee8; color: #263b72; font-size: 12pt; font-weight: 800; break-after: avoid; page-break-after: avoid; }
        .section-note { margin: -2mm 0 3mm; color: #697386; font-size: 8pt; }
        .distribution-wrap { padding: 3mm 1mm 0; break-inside: avoid; page-break-inside: avoid; }
        .score-distribution { display: block; width: 100%; height: 35mm; overflow: visible; }
        .distribution-axis { stroke: #70798a; stroke-width: 1; }
        .distribution-label { fill: #596273; font-size: 11px; }
        .student-marker { fill: #fff; stroke: #455fab; stroke-width: 1.6; }
        .average-marker { stroke: #172033; stroke-width: 1.2; stroke-dasharray: 4 3; }
        .average-label { fill: #172033; font-size: 11px; font-weight: 800; }
        .report-table { width: 100%; border-collapse: collapse; border-spacing: 0; }
        .report-table thead { display: table-header-group; }
        .report-table tr { break-inside: avoid; page-break-inside: avoid; }
        .report-table th { padding: 2.2mm 2.5mm; border-bottom: 1.2px solid #65718a; color: #4e596b; font-size: 7.5pt; font-weight: 800; text-align: left; }
        .report-table td { padding: 2.2mm 2.5mm; border-bottom: 1px solid #e1e5ec; }
        .report-table th:first-child, .report-table td:first-child { width: 14%; text-align: center; }
        .report-table .numeric { text-align: right; font-variant-numeric: tabular-nums; }
        .rank-number { font-weight: 800; color: #263b72; }
        .empty-row { padding: 8mm !important; color: #7b8494; text-align: center !important; }
        .question-section { break-before: auto; }
        .question-table th:first-child, .question-table td:first-child { width: 18%; }
        .report-footer { margin-top: 7mm; padding-top: 2mm; border-top: 1px solid #d9dee8; color: #7b8494; font-size: 7pt; }
      `}</style>

      <header className="report-header">
        <p className="report-kicker">시험 결과 리포트</p>
        <h1 className="report-title">{testTitle}</h1>
        <p className="report-meta"><span>{classNameText}</span><span>시험일 {testDateText}</span></p>
      </header>

      <section className="metric-strip" aria-label="시험 핵심 통계">
        <div className="metric"><span className="metric-label">전체 응시자</span><strong className="metric-value">{stats.submittedCount ?? 0}명</strong></div>
        <div className="metric"><span className="metric-label">평균</span><strong className="metric-value">{formatNumber(stats.average)}점</strong></div>
        <div className="metric"><span className="metric-label">최고점</span><strong className="metric-value">{formatNumber(stats.maxScore)}점</strong></div>
        <div className="metric"><span className="metric-label">최저점</span><strong className="metric-value">{formatNumber(stats.minScore)}점</strong></div>
      </section>

      <section className="section distribution-wrap">
        <h2 className="section-heading">성적 분포</h2>
        <p className="section-note">점 하나가 응시자 한 명의 실제 원점수이며, 점이 겹치지 않도록 세로 위치만 나누었습니다.</p>
        <ScoreDistribution scores={scores} average={stats.average} maxScore={stats.maxScore} />
      </section>

      <section className="section ranking-section">
        <h2 className="section-heading">응시자 성적 순위</h2>
        <table className="report-table ranking-table">
          <thead><tr><th>석차</th><th>학생</th><th className="numeric">점수</th><th className="numeric">평균 대비</th></tr></thead>
          <tbody>
            {rankings.length ? rankings.map((row) => {
              const delta = row.score - stats.average;
              return <tr key={row.studentId}><td className="rank-number">{row.rank}</td><td>{row.studentName}</td><td className="numeric">{formatNumber(row.score)}</td><td className="numeric">{delta > 0 ? '+' : ''}{formatNumber(delta)}</td></tr>;
            }) : <tr><td colSpan="4" className="empty-row">응시 결과가 없습니다.</td></tr>}
          </tbody>
        </table>
      </section>

      {questionStats.length > 0 && <section className="section question-section">
        <h2 className="section-heading">문항별 분석</h2>
        <p className="section-note">전체 응시자의 저장된 정오답 데이터를 기준으로 계산했습니다.</p>
        <table className="report-table question-table">
          <thead><tr><th>문항</th><th className="numeric">배점</th><th className="numeric">정답자</th><th className="numeric">응시자</th><th className="numeric">정답률</th></tr></thead>
          <tbody>{questionStats.map((row) => <tr key={row.question}><td>{row.question}</td><td className="numeric">{row.pointValue == null ? '-' : formatNumber(row.pointValue)}</td><td className="numeric">{row.correctCount}</td><td className="numeric">{row.submittedCount}</td><td className="numeric">{formatNumber(row.correctRate)}%</td></tr>)}</tbody>
        </table>
      </section>}

      <footer className="report-footer">본 문서는 성적 관리 화면의 저장 데이터를 기준으로 생성되었습니다.</footer>
    </article>
  );
});

export default GradePrintDocument;
