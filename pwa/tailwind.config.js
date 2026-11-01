/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        posture: {
          good: "#10B981",    // Emerald / Green
          warning: "#F59E0B", // Amber / Yellow
          bad: "#EF4444",     // Red
          offline: "#6B7280"  // Gray
        }
      }
    },
  },
  plugins: [],
}

