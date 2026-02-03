import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'tactical-green': '#4ade80',
      },
      fontFamily: {
        sans: ['IBM Plex Mono', 'monospace'],
        display: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
