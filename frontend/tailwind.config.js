/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Kerala/Kathakali-inspired palette: deep maroon backdrop, gold accents
        // (temple brass), emerald (coconut-palm greens), and vermilion highlight
        // (the red used in traditional Kathakali makeup).
        // Flat color aliases matching the unhyphenated class names used across components
        maroon950: "#1A0F0A",
        maroon900: "#2B1710",
        maroon800: "#3D2117",
        gold400: "#E8B84B",
        gold500: "#D4A033",
        gold600: "#B8842A",
        emerald500: "#1F6F54",
        emerald600: "#17543F",
        vermilion500: "#C73E1D",
        vermilion600: "#A3321A",
        ivory: "#F5EDE0",

        // Nested definitions for standard hyphenated syntax (maroon-950, gold-500, etc.)
        maroon: {
          950: "#1A0F0A",
          900: "#2B1710",
          800: "#3D2117",
        },
        gold: {
          400: "#E8B84B",
          500: "#D4A033",
          600: "#B8842A",
        },
        emerald: {
          500: "#1F6F54",
          600: "#17543F",
        },
        vermilion: {
          500: "#C73E1D",
          600: "#A3321A",
        },
      },
      fontFamily: {
        display: ["System"],
      },
    },
  },
  plugins: [],
};
