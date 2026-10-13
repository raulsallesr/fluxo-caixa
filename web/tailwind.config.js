/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surf: "rgb(var(--surf) / <alpha-value>)",
        surf2: "rgb(var(--surf2) / <alpha-value>)",
        borda: "rgb(var(--borda) / <alpha-value>)",
        tx: "rgb(var(--tx) / <alpha-value>)",
        tx2: "rgb(var(--tx2) / <alpha-value>)",
        azul: "rgb(var(--azul) / <alpha-value>)",
        laranja: "rgb(var(--laranja) / <alpha-value>)",
        vermelho: "rgb(var(--vermelho) / <alpha-value>)",
        verde: "rgb(var(--verde) / <alpha-value>)",
        cinza: "rgb(var(--cinza) / <alpha-value>)",
      },
      fontFamily: { sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
};
