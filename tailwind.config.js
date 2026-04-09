/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', 'Malgun Gothic', '맑은 고딕', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Brand teal — warmer, deeper
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        // Warm cream background
        cream: {
          50: '#FEFCF8',
          100: '#FDF8F0',
          200: '#FAF1E0',
        },
        // Per-destination accent colors
        welfare: '#A855F7',  // purple
        hospital: '#3B82F6', // blue
        pharmacy: '#10B981', // green
        home: '#F59E0B',     // amber
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgb(0 0 0 / 0.08), 0 4px 16px -4px rgb(0 0 0 / 0.04)',
        card: '0 1px 3px rgb(0 0 0 / 0.05), 0 8px 24px -4px rgb(0 0 0 / 0.06)',
        lift: '0 10px 32px -8px rgb(15 118 110 / 0.25)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
        'warm-gradient': 'linear-gradient(135deg, #FEFCF8 0%, #FDF8F0 100%)',
      },
    },
  },
  plugins: [],
}
