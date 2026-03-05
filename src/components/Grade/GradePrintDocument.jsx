import React, { forwardRef, useMemo } from 'react';

const formatValue = (value, digits = 1) => (
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-'
);

const GradePrintDocument = forwardRef(function GradePrintDocument(props, ref) {
  const {
    classNameText,
    testTitle,
    testDateText,
    stats,
    chart,
    questionStats,
    printScale = 1,
  } = props;

  const top5Text = useMemo(
    () => (stats?.top5 || []).map((x) => `${x.name}(${formatValue(x.score)})`).join(', '),
    [stats],
  );
  const bottom5Text = useMemo(
    () => (stats?.bottom5 || []).map((x) => `${x.name}(${formatValue(x.score)})`).join(', '),
    [stats],
  );

  const maxBinCount = Math.max(...(chart?.bins || []).map((x) => x.count || 0), 1);
  const BAR_AREA_H = 160;

  return (
    <div
      ref={ref}
      className="print-root grade-print-root no-print-scroll"
      style={{ transform: `scale(${printScale})`, transformOrigin: 'top left' }}
    >
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; break-before: page; }
          /* print.css가 있는 경우에도 여기서 추가 보정 */
          .print-root, .print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        .grade-print-root { color: #111827; font-family: ui-sans-serif, system-ui, -apple-system; }
        .print-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
        .print-sub { font-size: 12px; color: #374151; margin-bottom: 10px; font-weight: 700; }

        /* ✅ A4 가로 2단 구성(1페이지) */
        .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; align-items: start; }
        .avoid-break { break-inside: avoid; page-break-inside: avoid; }

        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
        .card h3 { font-size: 12px; font-weight: 900; color: #374151; margin-bottom: 6px; }
        .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .kv > div { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; }
        .kv .k { font-size: 11px; color: #374151; font-weight: 800; }
        .kv .v { font-size: 14px; font-weight: 900; margin-top: 2px; }
        .rank { font-size: 12px; line-height: 1.4; color: #111827; font-weight: 700; }

        .chartWrap { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
        .chartTitle { font-size: 12px; font-weight: 900; color: #374151; margin-bottom: 8px; }

        /* ✅ 라벨이 잘리지 않도록 bar영역/라벨영역 분리 */
        .bars { display: flex; gap: 6px; align-items: flex-end; }
        .barCol { flex: 1; display: flex; flex-direction: column; align-items: stretch; }
        .barArea { height: ${BAR_AREA_H}px; display: flex; align-items: flex-end; }
        .bar { width: 100%; border: 1px solid #d1d5db; border-radius: 6px 6px 0 0; position: relative; background: #eef2ff; }
        .barCount { position: absolute; top: -16px; left: 0; right: 0; text-align: center; font-size: 11px; color: #111827; font-weight: 900; }
        .barLabel { font-size: 11px; color: #111827; text-align: center; margin-top: 6px; font-weight: 800; }

        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th, .tbl td { border: 1px solid #111827; padding: 6px 6px; font-size: 11px; }
        .tbl th { background: #f3f4f6; font-weight: 900; color: #111827; }
        .tbl td { color: #111827; }
      `}</style>

            {/* ================= 1페이지 ================= */}
      <div className="avoid-break">
        <div className="print-title">{classNameText} · {testDateText}</div>
        <div className="print-sub">{testTitle}</div>

        <div className="print-grid">
          <div className="card avoid-break">
            <h3>시험 요약</h3>
            <div className="kv">
              <div><div className="k">응시자 수</div><div className="v">{stats?.count ?? '-'}</div></div>
              <div><div className="k">평균</div><div className="v">{formatValue(stats?.avg)}</div></div>
              <div><div className="k">중앙값</div><div className="v">{formatValue(stats?.median)}</div></div>
              <div><div className="k">표준편차</div><div className="v">{formatValue(stats?.stddev)}</div></div>
            </div>

            <div style={{ marginTop: 10 }} className="kv">
              <div>
                <div className="k">최고점 Top 5</div>
                <div className="rank">{top5Text || '-'}</div>
              </div>
              <div>
                <div className="k">최저점 Bottom 5</div>
                <div className="rank">{bottom5Text || '-'}</div>
              </div>
            </div>
          </div>

          <div className="chartWrap avoid-break">
            <div className="chartTitle">점수분포 그래프(원점수)</div>
            <div className="bars">
              {(chart?.bins || []).map((b, idx) => {
                const h = Math.round(((b.count || 0) / maxBinCount) * BAR_AREA_H);
                return (
                  <div key={`${b.label}-${idx}`} className="barCol">
                    <div className="barArea">
                      <div className="bar" style={{ height: `${h}px` }}>
                        <div className="barCount">{b.count || 0}</div>
                      </div>
                    </div>
                    <div className="barLabel">{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ================= 2페이지 ================= */}
      <div className="page-break" />

      <div className="card">
        <h3>문항별 정답률(응시자 기준)</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 80 }}>문항</th>
              <th style={{ width: 120 }}>정답자</th>
              <th style={{ width: 120 }}>응시자</th>
              <th>정답률</th>
            </tr>
          </thead>
          <tbody>
            {(questionStats || []).map((row) => (
              <tr key={row.q}>
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{row.q}</td>
                <td style={{ textAlign: 'center' }}>{row.correct}</td>
                <td style={{ textAlign: 'center' }}>{row.total}</td>
                <td style={{ textAlign: 'center' }}>{Math.round((row.rate || 0) * 10) / 10}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default GradePrintDocument;