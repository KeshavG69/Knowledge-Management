/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Roboto', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        xs: ['1rem', { lineHeight: '1.375', letterSpacing: '0.01em' }],         // 16px (was 18px, -2px)
        sm: ['1.125rem', { lineHeight: '1.375', letterSpacing: '0.01em' }],     // 18px (was 20px, -2px) 
        base: ['1.25rem', { lineHeight: '1.5', letterSpacing: '0.015em' }],     // 20px (was 22px, -2px)
        lg: ['1.375rem', { lineHeight: '1.5', letterSpacing: '0.015em' }],     // 22px (was 24px, -2px)
        xl: ['1.5rem', { lineHeight: '1.5', letterSpacing: '0.02em' }],        // 24px (was 26px, -2px)
        '2xl': ['1.75rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],    // 28px (was 30px, -2px)
        '3xl': ['2.125rem', { lineHeight: '1.3', letterSpacing: '0.025em' }],  // 34px (was 36px, -2px)
        '4xl': ['2.625rem', { lineHeight: '1.2', letterSpacing: '0.025em' }],  // 42px (was 44px, -2px)
        '5xl': ['3.375rem', { lineHeight: '1.1', letterSpacing: '0.03em' }],   // 54px (was 56px, -2px)
      },
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
        normal: '0em',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em',
        'extra-wide': '0.15em',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

