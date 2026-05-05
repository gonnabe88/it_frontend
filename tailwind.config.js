/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./app/components/**/*.{js,vue,ts}",
    "./app/layouts/**/*.vue",
    "./app/pages/**/*.vue",
    "./app/plugins/**/*.{js,ts}",
    "./app/app.vue",
    "./app/error.vue",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['NotoSansKR', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:      '#eef2ff', // indigo-50
          100:     '#e0e7ff', // indigo-100
          200:     '#c7d2fe', // indigo-200
          300:     '#a5b4fc', // indigo-300
          400:     '#818cf8', // indigo-400
          500:     '#6366f1', // indigo-500
          600:     '#4f46e5', // indigo-600
          700:     '#4338ca', // indigo-700
          800:     '#3730a3', // indigo-800
          900:     '#312e81', // indigo-900
          DEFAULT: '#4f46e5', // indigo-600
          hover:   '#4338ca', // indigo-700
          light:   '#eef2ff', // indigo-50 (alias)
          ring:    'rgba(99,102,241,0.3)', // indigo-500/30
        },
      },
    },
  },
  plugins: [],
}
