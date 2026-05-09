import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        shell: {
          canvas: 'hsl(var(--shell-canvas))',
          surface: 'hsl(var(--shell-surface))',
          'surface-muted': 'hsl(var(--shell-surface-muted))',
          border: 'hsl(var(--shell-border))',
          subtle: 'hsl(var(--shell-subtle))',
          warning: 'hsl(var(--shell-warning))',
          'warning-foreground': 'hsl(var(--shell-warning-foreground))',
          'nav-accent': 'hsl(var(--shell-nav-accent) / <alpha-value>)',
          'nav-accent-foreground': 'hsl(var(--shell-nav-accent-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        panel: '0 16px 48px -24px rgba(15, 23, 42, 0.28)',
        'shell-sm': '0 8px 24px -20px rgba(15, 23, 42, 0.35)',
        'shell-md': '0 18px 48px -28px rgba(15, 23, 42, 0.38)',
        'shell-lg': '0 28px 80px -38px rgba(15, 23, 42, 0.42)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        'shell-content': 'var(--shell-content-width)',
        'shell-wide': 'var(--shell-wide-width)',
      },
      height: {
        'shell-header': 'var(--shell-header-height)',
      },
    },
  },
  plugins: [],
};

export default config;
