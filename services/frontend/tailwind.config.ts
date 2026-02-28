import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        neon: "0 0 40px rgba(56,189,248,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
