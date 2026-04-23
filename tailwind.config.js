/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        crt: {
          bg: '#0a0a0a',
          phosphor: '#39ff14',
          amber: '#ffb300',
          red: '#ff3b30',
          cream: '#f5e6c8',
          bezel: '#2b2422',
          bezelLight: '#4a3f3a',
          bezelDark: '#1a1412',
        },
        vhs: {
          pink: '#ff006e',
          cyan: '#00f0ff',
          purple: '#8338ec',
          yellow: '#ffbe0b',
        },
      },
      fontFamily: {
        crt: ['"VT323"', 'monospace'],
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      animation: {
        'crt-flicker': 'crt-flicker 0.15s infinite',
        'scanline': 'scanline 8s linear infinite',
        'channel-change': 'channel-change 0.3s ease-out',
        'blink': 'blink 1s step-end infinite',
        'boot': 'boot 1.2s ease-out forwards',
      },
      keyframes: {
        'crt-flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.97' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'channel-change': {
          '0%': { opacity: '0', filter: 'brightness(3)' },
          '50%': { opacity: '1', filter: 'brightness(1.5)' },
          '100%': { opacity: '1', filter: 'brightness(1)' },
        },
        'blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'boot': {
          '0%': { transform: 'scaleY(0.01) scaleX(1)', opacity: '0' },
          '30%': { transform: 'scaleY(0.01) scaleX(1)', opacity: '1' },
          '60%': { transform: 'scaleY(1) scaleX(0.05)', opacity: '1' },
          '100%': { transform: 'scaleY(1) scaleX(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
