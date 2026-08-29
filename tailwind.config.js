/** @type {import('tailwindcss').Config} */
// Tailwind 配置：content 扫描范围覆盖 index.html 与 src 全部源码；
// 主题仅扩展了品牌主色 primary（蓝色梯度），其余沿用默认工具类。
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
