// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#334a91',   // 브랜드 딥 블루 (헤더, 타이틀)
          main: '#455fab',   // 브랜드 Primary (버튼, 아이콘)
          light: '#cfd8ff',  // 브랜드 라이트/보더 포인트
          bg: '#f8fafc',     // 전체 배경색 (라이트 그레이)
          gray: '#C7C7CC',   // 테두리, 회색 텍스트
          black: '#000000',  // 기본 텍스트
          red: '#FF003A',    // 알림, 경고
        }
      },
      fontFamily: {
        // 영문 Open Sans 우선, 한글은 Apple SD Gothic Neo (산돌고딕네오 시스템 폰트)
        sans: ['"Open Sans"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'sans-serif'],
      },
      boxShadow: {
        'brand': '0 4px 20px -2px rgba(69, 95, 171, 0.2)', // 브랜드 컬러 그림자
      }
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide') // 기존에 사용 중이던 플러그인 유지
  ],
}