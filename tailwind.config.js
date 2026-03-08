/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        polka: {
          pink:    '#E6007A',
          'pink-dim': '#b8005f',
          black:   '#0a0a0a',
          surface: '#111116',
          card:    '#16161e',
          card2:   '#1c1c26',
          border:  'rgba(230,0,122,0.18)',
          border2: 'rgba(255,255,255,0.07)',
          text:    '#f0f0f8',
          muted:   '#7070a0',
          green:   '#00e887',
          yellow:  '#f5c518',
          blue:    '#6c9fff',
          purple:  '#9b59d0',
        },
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        body:    ['var(--font-syne)', 'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'monospace'],
      },
      animation: {
        'pulse-pink': 'pulse-pink 2.5s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
        'spin-slow':  'spin 8s linear infinite',
        'glow':       'glow 2s ease-in-out infinite alternate',
        'slide-up':   'slide-up 0.4s ease both',
        'fade-in':    'fade-in 0.5s ease both',
      },
      keyframes: {
        'pulse-pink': {
          '0%,100%': { boxShadow: '0 0 20px rgba(230,0,122,0.5)' },
          '50%':     { boxShadow: '0 0 50px rgba(230,0,122,0.9), 0 0 80px rgba(230,0,122,0.3)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        glow: {
          from: { filter: 'drop-shadow(0 0 6px rgba(230,0,122,0.6))' },
          to:   { filter: 'drop-shadow(0 0 20px rgba(230,0,122,1))' },
        },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
      },
      backgroundImage: {
        'grid-polka': "linear-gradient(rgba(230,0,122,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(230,0,122,0.04) 1px,transparent 1px)",
        'glow-radial': 'radial-gradient(circle, rgba(230,0,122,0.15) 0%, transparent 70%)',
      },
      backgroundSize: {
        'grid': '60px 60px',
      },
    },
  },
  plugins: [],
};
