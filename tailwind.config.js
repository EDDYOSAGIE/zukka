/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A2540",
        midnight: "#071A2D",
        skybrand: "#7CC7E8",
        mist: "#F2F8FB",
        emerald: "#00A896",
        slatecopy: "#637381"
      },
      boxShadow: {
        calm: "0 18px 50px rgba(10, 37, 64, 0.12)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
