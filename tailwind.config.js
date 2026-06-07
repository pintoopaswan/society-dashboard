/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-body)'],
        display: ['var(--font-display)'],
      },
      colors: {
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          900: '#7c2d12',
        },
        surface: {
          DEFAULT: '#f8fafc',
          card:    '#ffffff',
          border:  '#e6e9ef',
          muted:   '#94a3b8',
        },
      },
    },
  },
  plugins: [],
}
