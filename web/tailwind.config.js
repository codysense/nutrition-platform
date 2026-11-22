/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { 50: '#eef6f0', 100: '#d8ebdd', 500: '#2f8a4f', 600: '#1e6b3a', 700: '#175530' } },
    },
  },
  plugins: [],
};
