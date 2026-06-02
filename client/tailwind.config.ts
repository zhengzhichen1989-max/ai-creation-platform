import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0e7ff',
          100: '#d4beff',
          200: '#b792ff',
          300: '#9b66ff',
          400: '#7e3aff',
          500: '#6200ea',
          600: '#5600d8',
          700: '#4a00c1',
          800: '#3e00a9',
          900: '#320091',
        },
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};

export default config;
