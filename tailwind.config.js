/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // 화면 크기 기준(breakpoint) 커스텀
      screens: {
        'lg': '900px', // 기본값 1024px -> 900px로 변경 (원하는 값으로 조절 가능)
      },
    },
  },
  plugins: [],
}