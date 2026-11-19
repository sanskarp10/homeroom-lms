/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // The palette comes from a classroom: chalkboard, paper, pencil, red marking pen.
        board: { DEFAULT: '#1F3A33', 950: '#0F1D19', 900: '#152922', 800: '#1A312B', 700: '#27483F', 600: '#35594F', 500: '#4C7468' },
        paper: '#F4F6F2',
        ink: { DEFAULT: '#14211D', soft: '#3F4F49', faint: '#66756F' },
        line: { DEFAULT: '#DAE0DA', strong: '#C3CCC5' },
        pencil: { DEFAULT: '#F2B632', dark: '#B97F06', deep: '#8A5E00', light: '#FCEFC7' },
        redpen: { DEFAULT: '#C03A2B', light: '#FBE9E6' },
        pass: { DEFAULT: '#1E7A53', light: '#E3F3EA' },
        chalk: '#EDF1EA',
      },
      fontFamily: {
        display: ['"Besley Variable"', 'Besley', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk Variable"', '"Hanken Grotesk"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', '1rem'],
      },
      borderRadius: { cover: '5px', panel: '14px' },
      boxShadow: {
        lift: '0 1px 0 rgba(20,33,29,.04), 0 8px 24px -12px rgba(20,33,29,.22)',
        pop: '0 12px 40px -12px rgba(15,29,25,.45)',
        book: '2px 3px 0 rgba(20,33,29,.10), 6px 10px 18px -10px rgba(20,33,29,.35)',
      },
      maxWidth: { page: '76rem' },
      keyframes: {
        chalk: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        toast: { from: { opacity: '0', transform: 'translateY(8px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { to: { backgroundPosition: '-200% 0' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
      },
      animation: {
        chalk: 'chalk .5s cubic-bezier(.2,.7,.2,1) both',
        toast: 'toast .18s ease-out both',
        fade: 'fade .15s ease-out both',
        pop: 'pop .16s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
