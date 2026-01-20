/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // WhatsApp Brand Colors
        'whatsapp': {
          green: '#25D366',
          'green-dark': '#128C7E',
          teal: '#075E54',
        },
        // Task Status Colors
        'task': {
          pending: '#3B82F6',
          progress: '#EAB308',
          completed: '#22C55E',
          approved: '#22C55E',
          reopened: '#A855F7',
          overdue: '#EF4444',
        },
        // Chat Colors (Light)
        'chat': {
          bg: '#ECE5DD',
          incoming: '#FFFFFF',
          outgoing: '#DCF8C6',
        },
        // Dark Mode Colors
        'dark': {
          bg: '#111B21',
          surface: '#202C33',
          'surface-elevated': '#233138',
          incoming: '#1F2C34',
          outgoing: '#005C4B',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'message': ['15px', { lineHeight: '20px' }],
        'timestamp': ['11px', { lineHeight: '15px' }],
      },
      borderRadius: {
        'bubble': '7.5px',
      },
      boxShadow: {
        'message': '0 1px 0.5px rgba(0, 0, 0, 0.13)',
      },
      animation: {
        'typing': 'typing 1.4s infinite',
        'message-in': 'messageIn 0.2s ease-out',
      },
      keyframes: {
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
        messageIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
