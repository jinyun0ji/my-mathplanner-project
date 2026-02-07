import React, { useMemo, useState } from 'react';
import MathText from './MathText';

const samples = [
  {
    title: '분수 / 거듭제곱 / 제곱근',
    latex: [
      '분수: \\\\frac{a}{b}',
      '거듭제곱: x^2, a^{n}',
      '제곱근: \\\\sqrt{x}, \\\\sqrt[n]{x}',
    ].join('\n'),
  },
  {
    title: '절댓값 / 괄호 / 범위 조건',
    latex: [
      '절댓값: \\\\left|x\\\\right|',
      '괄호 자동크기: \\\\left( \\\\frac{a}{b} \\\\right)',
      '구간: x \\\\in [a,b], (a,b)',
    ].join('\n'),
  },
  {
    title: '리미트 / 극한',
    latex: [
      '\\\\lim_{x \\\\to 0} \\\\frac{\\\\sin x}{x}',
      '\\\\lim_{n \\\\to \\\\infty} \\\\left(1 + \\\\frac{1}{n}\\\\right)^n',
    ].join('\n'),
  },
  {
    title: '시그마 / 합',
    latex: [
      '\\\\sum_{k=1}^{n} k = \\\\frac{n(n+1)}{2}',
      '\\\\sum_{k=0}^{n} ar^k = a \\\\frac{1-r^{n+1}}{1-r}',
    ].join('\n'),
  },
  {
    title: '로그 / 지수',
    latex: [
      '\\\\log_a b = \\\\frac{\\\\ln b}{\\\\ln a}',
      'a^{x+y}=a^x a^y, \\\\; a^{x-y}=\\\\frac{a^x}{a^y}',
    ].join('\n'),
  },
  {
    title: '삼각함수',
    latex: [
      '\\\\sin^2 x + \\\\cos^2 x = 1',
      '\\\\sin(2x)=2\\\\sin x\\\\cos x',
      '\\\\cos(2x)=\\\\cos^2 x-\\\\sin^2 x',
    ].join('\n'),
  },
  {
    title: '행렬(가끔 필요할 때)',
    latex: [
      '\\\\begin{pmatrix} a & b \\\\ c & d \\\\end{pmatrix}',
    ].join('\n'),
  },
];

const formatPreviewLine = (line) => {
  if (!line.trim()) return line;
  const separatorIndex = line.indexOf(':');
  if (separatorIndex !== -1) {
    const label = line.slice(0, separatorIndex + 1);
    const expression = line.slice(separatorIndex + 1).trim();
    if (!expression) return line;
    return `${label} \\(${expression}\\)`;
  }
  return `\\(${line}\\)`;
};

const buildPreviewText = (latex) =>
  latex.split('\n').map(formatPreviewLine).join('\n');

export default function LatexGuide({ className = '' }) {
  const [open, setOpen] = useState(false);

  const guideText = useMemo(() => {
    return [
      '수식은 다음 구분자를 사용합니다:',
      '- 줄 안 수식: \\\\( ... \\\\)',
      '- 줄 전체(블록) 수식: $$ ... $$',
      '',
      '예시:',
      '\\\\( \\\\frac{a}{b} \\\\)',
      '$$ \\\\sum_{k=1}^{n} k = \\\\frac{n(n+1)}{2} $$',
    ].join('\n');
  }, []);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-2"
      >
        <span>{open ? '▼' : '▶'} LaTeX 수식 가이드 보기</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="text-xs text-gray-700">
            <div className="font-bold mb-1">사용 방법</div>
            <pre className="whitespace-pre-wrap break-words text-[11px] text-gray-700 bg-white border border-gray-200 rounded-lg p-2">
              {guideText}
            </pre>
          </div>

          <div className="text-xs text-gray-700">
            <div className="font-bold mb-1">자주 쓰는 예시 (복사해서 사용)</div>
            <div className="space-y-2">
              {samples.map((sample) => (
                <div
                  key={sample.title}
                  className="rounded-lg border border-gray-200 bg-white p-2"
                >
                  <div className="text-[11px] font-bold text-gray-700">
                    {sample.title}
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2">
                    {sample.latex}
                  </pre>
                  <div className="mt-2 text-[11px] text-gray-500">
                    미리보기:
                  </div>
                  <MathText
                    text={buildPreviewText(sample.latex)}
                    className="text-sm text-gray-900"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-gray-500">
            * 수식 문법이 틀려도 화면이 깨지지 않도록 처리되어 있습니다(에러는
            빨간색으로 표시될 수 있음).
          </div>
        </div>
      )}
    </div>
  );
}