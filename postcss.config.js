export default {
  plugins: {
    '@csstools/postcss-oklab-function': { preserve: true },
    'postcss-preset-env': {
      features: {
        'oklab-function': false, // handled by the dedicated plugin above
        'color-mix': true,
        'custom-properties': false, // don't flatten CSS vars
        'nesting-rules': false, // Tailwind handles this
      },
      browsers: ['> 0.5%', 'last 4 versions', 'not dead', 'Chrome >= 80'],
    },
  },
}
