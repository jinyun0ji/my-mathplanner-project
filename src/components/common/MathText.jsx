import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// KaTeX auto-render는 별도 엔트리로 import해야 함
import renderMathInElement from 'katex/contrib/auto-render';

export default function MathText({ text, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 1) 원문을 먼저 안전하게 텍스트로 넣는다(HTML 인젝션 방지)
    //    - 줄바꿈은 CSS로 처리(whitespace-pre-wrap)
    el.textContent = text ?? '';

    // 2) auto-render로 수식만 변환
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false, // 문법 에러여도 화면 안죽게
        errorColor: '#cc0000',
      });
    } catch (e) {
      // 실패 시에는 그냥 원문 텍스트 유지
      // console.warn('[MathText] render failed', e);
    }
  }, [text]);

  return (
    <div
      ref={ref}
      className={`whitespace-pre-wrap break-words ${className}`}
    />
  );
}