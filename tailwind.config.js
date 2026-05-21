/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        sci: {
          red: '#dc2626',
          bg: '#f1f5f9',
          card: '#ffffff',
          border: '#e2e8f0',
          text: '#0f172a',
          muted: '#64748b',
        }
      }
    }
  },
  plugins: []
}
