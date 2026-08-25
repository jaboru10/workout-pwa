/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      colors: {
        ink: '#0a0a0b',
        panel: '#141416',
        panel2: '#1c1c1f',
        line: '#2a2a2e',
        chalk: '#f2f2ef',
        muted: '#8a8a92',
        volt: '#d7ff3e',
        blood: '#ff4d4d'
      }
    }
  },
  plugins: []
}
