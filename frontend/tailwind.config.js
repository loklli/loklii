/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        amber: { DEFAULT: '#BA7517', light: '#D4901F', dark: '#9A6010' },
        teal: { DEFAULT: '#1D9E75', light: '#22B585', dark: '#177A5A' },
        cream: { DEFAULT: '#FAEEDA', light: '#FDF6EE', dark: '#F0DFC0' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      screens: { xs: '375px' },
    },
  },
  plugins: [],
};
