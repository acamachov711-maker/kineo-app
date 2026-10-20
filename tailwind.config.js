/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kineo: {
          bg: '#090D16',
          card: '#111827',
          border: '#1F2937',
          accent: '#10B981',
          partner: '#EC4899',
          amber: '#F59E0B',
          purple: '#8B5CF6'
        }
      }
    },
  },
  plugins: [],
}
