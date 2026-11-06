/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0d631b',
          container: '#2e7d32',
          fixed: '#a3f69c',
          'fixed-dim': '#88d982',
        },
        'on-primary': '#ffffff',
        'on-primary-container': '#cbffc2',
        secondary: {
          DEFAULT: '#005db7',
          container: '#64a1ff',
          fixed: '#d6e3ff',
          'fixed-dim': '#a9c7ff',
        },
        'on-secondary': '#ffffff',
        'on-secondary-container': '#003670',
        tertiary: {
          DEFAULT: '#545656',
          container: '#6c6e6e',
          fixed: '#e2e2e2',
        },
        'on-tertiary': '#ffffff',
        surface: {
          DEFAULT: '#fbf9f8',
          bright: '#fbf9f8',
          dim: '#dcd9d9',
          'container-lowest': '#ffffff',
          'container-low': '#f5f3f3',
          container: '#f0eded',
          'container-high': '#eae8e7',
          'container-highest': '#e4e2e1',
        },
        'on-surface': '#1b1c1c',
        'on-surface-variant': '#40493d',
        'inverse-surface': '#303030',
        'inverse-on-surface': '#f2f0f0',
        'inverse-primary': '#88d982',
        outline: '#707a6c',
        'outline-variant': '#bfcaba',
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        'on-error': '#ffffff',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1.5rem',
        full: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
