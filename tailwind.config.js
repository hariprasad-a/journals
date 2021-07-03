module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    textColor: ['responsive', 'hover', 'focus', 'group-hover'],
    border: ['hover', 'focus'],
    backgroundColor: ['active', 'hover'],
    opacity: ({ after }) => after(['disabled'])
  },
  plugins: [],
}
