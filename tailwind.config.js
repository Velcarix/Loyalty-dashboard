/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-dark': '#1D4ED8',
        ink: '#0B132B',
        accent: '#16A34A',
        'brand-navy': '#0F2540',
        signal: '#22C55E',
        'signal-soft': '#F0FDF4',
      },
    },
  },
  plugins: [],
}
