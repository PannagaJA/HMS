/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F0FDF9',
        brand: {
          dark: '#0D3833',
          emerald: '#064E3B',
          teal: '#0F766E',
        },
        pastel: {
          lime: '#E8F8CE',
          teal: '#D1F2EA',
          pink: '#FCE2E1',
          lavender: '#E0E7FF',
        }
      },
      borderRadius: {
        '3xl': '24px',
        '2xl': '16px',
        'xl': '12px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
