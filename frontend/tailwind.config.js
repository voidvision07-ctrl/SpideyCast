/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        spidey: {
          red: '#E50914',
          darkRed: '#8B0000',
          blue: '#0F172A',
          cyan: '#00F0FF',
          dark: '#090A0F',
          card: '#12151E'
        }
      }
    },
  },
  plugins: [],
}