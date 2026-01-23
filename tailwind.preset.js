/** @type {import('tailwindcss').Config} */

// Hammy's Design System - Tailwind Preset
// Clean & Minimal | Turquoise | Neumorphism | Dark Mode

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      // ========================================
      // COLORS - Turquoise Primary
      // ========================================
      colors: {
        // Primary - Turquoise
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // Main turquoise
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Accent - Complementary coral/orange
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Neutrals - Warm grays
        surface: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
      },

      // ========================================
      // NEUMORPHISM SHADOWS
      // ========================================
      boxShadow: {
        // Light mode neumorphism
        'neu-flat': '6px 6px 12px #d1d1d1, -6px -6px 12px #ffffff',
        'neu-pressed': 'inset 4px 4px 8px #d1d1d1, inset -4px -4px 8px #ffffff',
        'neu-convex': '6px 6px 12px #d1d1d1, -6px -6px 12px #ffffff, inset 1px 1px 2px #ffffff',
        'neu-concave': '6px 6px 12px #d1d1d1, -6px -6px 12px #ffffff, inset -1px -1px 2px #d1d1d1',

        // Dark mode neumorphism
        'neu-dark-flat': '6px 6px 12px #151515, -6px -6px 12px #252525',
        'neu-dark-pressed': 'inset 4px 4px 8px #151515, inset -4px -4px 8px #252525',
        'neu-dark-convex': '6px 6px 12px #151515, -6px -6px 12px #252525, inset 1px 1px 2px #252525',
        'neu-dark-concave': '6px 6px 12px #151515, -6px -6px 12px #252525, inset -1px -1px 2px #151515',

        // Subtle shadows
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.1)',

        // Glow effects
        'glow-primary': '0 0 20px rgba(20, 184, 166, 0.3)',
        'glow-primary-lg': '0 0 40px rgba(20, 184, 166, 0.4)',
      },

      // ========================================
      // TYPOGRAPHY
      // ========================================
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      letterSpacing: {
        'tightest': '-0.04em',
      },

      // ========================================
      // BORDER RADIUS - Soft & Rounded
      // ========================================
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },

      // ========================================
      // ANIMATIONS
      // ========================================
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'fade-in-down': 'fadeInDown 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.6s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(20, 184, 166, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(20, 184, 166, 0.6)' },
        },
      },

      // ========================================
      // TRANSITIONS
      // ========================================
      transitionDuration: {
        '400': '400ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // ========================================
      // SPACING & SIZING
      // ========================================
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },

      // ========================================
      // BACKDROP BLUR
      // ========================================
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
