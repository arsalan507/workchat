/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'whatsapp': {
          green: '#25D366',
          'green-dark': '#128C7E',
          teal: '#075E54',
        },
        'task': {
          pending: '#3B82F6',
          progress: '#EAB308',
          completed: '#22C55E',
          approved: '#22C55E',
          reopened: '#A855F7',
          overdue: '#EF4444',
        },
      },
    },
  },
  plugins: [],
}
