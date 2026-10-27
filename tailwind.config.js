/** @type {import('tailwindcss').Config} */

// Every shade of `slate` (and `surface`) is a CSS variable, defined in
// src/index.css for both the light and the dark theme. That is why the same
// classes (bg-slate-50, text-slate-900, border-slate-200 ...) work in both themes.
const withAlpha = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: withAlpha("--surface"),
        slate: {
          50: withAlpha("--slate-50"),
          100: withAlpha("--slate-100"),
          200: withAlpha("--slate-200"),
          300: withAlpha("--slate-300"),
          400: withAlpha("--slate-400"),
          500: withAlpha("--slate-500"),
          600: withAlpha("--slate-600"),
          700: withAlpha("--slate-700"),
          800: withAlpha("--slate-800"),
          850: withAlpha("--slate-850"),
          900: withAlpha("--slate-900"),
          950: withAlpha("--slate-950"),
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
    },
  },
  plugins: [],
};
