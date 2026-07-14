/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Token-driven palette (themeable via CSS variables)
        background: 'rgb(var(--sf-app-bg) / <alpha-value>)',
        surface: 'rgb(var(--sf-surface-bg) / <alpha-value>)',
        primary: 'rgb(var(--sf-primary) / <alpha-value>)',
        danger: 'rgb(var(--sf-danger) / <alpha-value>)',
        success: 'rgb(var(--sf-success) / <alpha-value>)',
        // Replace Tailwind defaults with themeable grays used across the app
        gray: {
          50: 'rgb(var(--sf-gray-50) / <alpha-value>)',
          100: 'rgb(var(--sf-gray-100) / <alpha-value>)',
          200: 'rgb(var(--sf-gray-200) / <alpha-value>)',
          300: 'rgb(var(--sf-gray-300) / <alpha-value>)',
          400: 'rgb(var(--sf-gray-400) / <alpha-value>)',
          500: 'rgb(var(--sf-gray-500) / <alpha-value>)',
          600: 'rgb(var(--sf-gray-600) / <alpha-value>)',
          700: 'rgb(var(--sf-gray-700) / <alpha-value>)',
          800: 'rgb(var(--sf-gray-800) / <alpha-value>)',
          900: 'rgb(var(--sf-gray-900) / <alpha-value>)'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl: 'var(--sf-radius-xl)',
        '2xl': 'var(--sf-radius-2xl)',
        '3xl': 'var(--sf-radius-3xl)',
        full: 'var(--sf-radius-full)',
      },
      boxShadow: {
        sm: 'var(--sf-shadow-sm)',
        md: 'var(--sf-shadow-md)',
        lg: 'var(--sf-shadow-lg)',
        xl: 'var(--sf-shadow-xl)',
      },
      backdropBlur: {
        sm: 'var(--sf-blur-sm)',
        md: 'var(--sf-blur-md)',
        lg: 'var(--sf-blur-lg)',
        xl: 'var(--sf-blur-xl)',
      },
      transitionDuration: {
        150: 'var(--sf-motion-fast)',
        200: 'var(--sf-motion-fast)',
        300: 'var(--sf-motion-normal)',
        500: 'var(--sf-motion-slow)',
      },
      transitionTimingFunction: {
        out: 'var(--sf-ease-out)',
        'in-out': 'var(--sf-ease-in-out)',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'fade-in-down': 'fade-in-down 0.5s ease-out',
      }
    },
  },
  plugins: [],
}
