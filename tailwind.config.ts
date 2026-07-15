import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        "2xl": "1rem",
      },
      colors: {
        sky: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
        brand: {
          primary: "#0585FC",
          secondary: "#0461C4",
          lima: "#CCFF00",
          "lima-subtle": "rgba(204,255,0,0.12)",
          navy: "#031733",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)",
        "brand-gradient-dark": "linear-gradient(135deg, #031733 0%, #0461C4 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
