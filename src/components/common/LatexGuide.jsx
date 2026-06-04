// src/components/common/LatexGuide.jsx
import React, { useMemo, useState } from 'react';

export default function LatexGuide({ className = '' }) {
  const [open, setOpen] = useState(false);

  const guideText = useMemo(() => {
    return [
      '수식은 다음 구분자를 사용합니다:',
      '- 줄 안 수식: \\( ... \\)',
      '- 줄 전체(블록) 수식: $$ ... $$',
      '',
      '예시:',
      '\\( \\frac{a}{b} \\)',
      '$$ \\sum_{k=1}^{n} k = \\frac{n(n+1)}{2} $$',
      '',
      '자주 쓰는 문법:',
      '- 분수: \\frac{a}{b}',
      '- 제곱근: \\sqrt{x}, \\sqrt[n]{x}',
      '- 리미트: \\lim_{x \\to 0}',
      '- 시그마: \\sum_{k=1}^{n}',
      '- 로그: \\log_a b, \\ln x',
      '- 삼각함수: \\sin x, \\cos x, \\tan x',
      '',
      '등차/등비수열:',
      '- 등차수열 일반항: a_n = a_1 + (n-1)d',
      '- 등차수열 합: S_n = \\frac{n(2a_1 + (n-1)d)}{2}',
      '- 등비수열 일반항: a_n = a_1 r^{n-1}',
      '- 등비수열 합(r\\neq 1): S_n = \\frac{ a_1(1-r^n)}{1-r}',
    ].join('\n');
  }, []);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-[#334a91] hover:text-[#334a91] inline-flex items-center gap-2"
      >
        <span>{open ? '▼' : '▶'} LaTeX 수식 가이드 보기</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="text-xs text-gray-700">
            <div className="font-bold mb-1">사용 방법</div>
            <pre className="whitespace-pre-wrap break-words text-[11px] text-gray-700 bg-white border border-gray-200 rounded-lg p-2">
              {guideText}
            </pre>
          </div>

          <div className="text-[11px] text-gray-500">
            * 수식은 반드시 <span className="font-mono">\\(...\\)</span> 또는 <span className="font-mono">$$...$$</span> 로 감싸야 미리보기/발송 메시지에서 수식으로 렌더링됩니다.
          </div>
        </div>
      )}
    </div>
  );
}