/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '"Noto Sans Devanagari"', '"Nirmala UI"', 'Mangal', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#F6F5F2',
        ink: { DEFAULT: '#1C1917', soft: '#44403C', muted: '#57534E' },
        risk: {
          red: '#B91C1C',
          redsoft: '#FEF2F2',
          yellow: '#FACC15',
          yellowsoft: '#FEFCE8',
          green: '#15803D',
          greensoft: '#F0FDF4',
          grey: '#4B5563',
          greysoft: '#F5F5F4',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,0.04), 0 2px 8px -2px rgba(28,25,23,0.06)',
        lift: '0 2px 4px rgba(28,25,23,0.04), 0 12px 28px -10px rgba(28,25,23,0.16)',
        pop: '0 20px 48px -12px rgba(28,25,23,0.28)',
      },
      borderRadius: { '4xl': '2rem' },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
    },
  },
  plugins: [],
}
