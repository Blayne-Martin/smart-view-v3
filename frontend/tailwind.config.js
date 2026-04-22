/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      colors: {
        status: {
          good: '#22c55e',
          warn: '#eab308',
          bad: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
