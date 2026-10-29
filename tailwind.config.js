/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Archivo Narrow"', 'sans-serif'],
        body: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: '#12151c',
        panel: '#191d26',
        panel2: '#1f2431',
        line: '#2b3140',
        chalk: '#eef0f5',
        muted: '#8f97a8',
        accent: '#a97bff',
        accentInk: '#1a1226',
        ok: '#4fd39a',
        danger: '#ff6b6b',
      },
      maxWidth: {
        app: '1400px',
      },
      keyframes: {
        pr: {
          '0%': { boxShadow: '0 0 0 0 rgba(169,123,255,0)' },
          '45%': { boxShadow: '0 0 0 4px rgba(169,123,255,0.28)' },
          '100%': { boxShadow: '0 0 0 0 rgba(169,123,255,0)' },
        },
      },
      animation: {
        pr: 'pr 1.2s ease-out',
      },
    },
  },
  plugins: [],
};
