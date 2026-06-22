/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/context/**/*.{js,jsx}",
    "./src/hooks/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        brand: "#256f7b",
        moss: "#6d8f5f",
        coral: "#c75f4b",
        cloud: "#f5f7f8"
      }
    }
  },
  plugins: []
};
