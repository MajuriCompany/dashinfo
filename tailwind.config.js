/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        success: '#16a34a',
        'success-light': '#dcfce7',
        warning: '#ca8a04',
        'warning-light': '#fef9c3',
        danger: '#dc2626',
        'danger-light': '#fee2e2',
      },
    },
  },
  plugins: [],
}
