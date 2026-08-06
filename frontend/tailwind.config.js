/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0ecfb',
          200: '#c1d9f7',
          300: '#a2c6f3',
          400: '#83b3ef',
          500: '#6400cc',
          600: '#0052cc',
          700: '#0043a4',
          800: '#003885',
          900: '#002d6b',
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
