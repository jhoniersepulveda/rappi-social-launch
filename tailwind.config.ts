import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '480px',
      },
      scale: {
        '102': '1.02',
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        rappi: {
          orange: "#FF441B",
          "light-orange": "#FF6B35",
          black: "#1A1A1A",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
