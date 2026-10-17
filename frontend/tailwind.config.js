/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9f4',
          100: '#dcf1e6',
          200: '#bce4cf',
          300: '#8dcfb0',
          400: '#5ab38c',
          500: '#3a9b73',
          600: '#2b7d5c',
          700: '#25644a',
          800: '#21503c',
          900: '#1d4232',
        },
        surface: {
          DEFAULT: '#0f1117',
          bg:      '#0f1117',
          card:    '#1a1d27',
          input:   '#252836',
          border:  '#2e3244',
          hover:   '#2a2d3e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-dot':  'pulseDot 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.3' },
          '40%':            { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
