import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dot: {
          pink: "#E6007A",
          black: "#0a0a0a",
          surface: "#111116",
          card: "#16161e",
          card2: "#1c1c26",
          muted: "#7070a0",
          green: "#00e887",
          yellow: "#f5c518",
          blue: "#6c9fff",
          purple: "#9b59d0",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "orbit": "orbit 8s linear infinite",
        "orbit-reverse": "orbit 12s linear infinite reverse",
        "spin-slow": "spin 20s linear infinite",
        "float": "float 4s ease-in-out infinite",
        "slide-in": "slideIn 0.4s ease both",
        "fade-up": "fadeUp 0.6s ease both",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(230,0,122,0.5)" },
          "50%": { boxShadow: "0 0 40px rgba(230,0,122,0.9), 0 0 70px rgba(230,0,122,0.3)" },
        },
        orbit: {
          from: { transform: "rotate(0deg) translateX(28px) rotate(0deg)" },
          to: { transform: "rotate(360deg) translateX(28px) rotate(-360deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
