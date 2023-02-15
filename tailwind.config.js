/* eslint-disable  @typescript-eslint/no-var-requires */
const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");
const plugin = require("tailwindcss/plugin");

module.exports = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx}", "./src/components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(ellipse at center, var(--tw-gradient-stops))",
        "gradient-radial-at-t": "radial-gradient(ellipse at top, var(--tw-gradient-stops))",
        "gradient-radial-at-b": "radial-gradient(ellipse at bottom, var(--tw-gradient-stops))",
        "gradient-radial-at-l": "radial-gradient(ellipse at left, var(--tw-gradient-stops))",
        "gradient-radial-at-r": "radial-gradient(ellipse at right, var(--tw-gradient-stops))",
        "gradient-radial-at-tl": "radial-gradient(ellipse at top left, var(--tw-gradient-stops))",
        "gradient-radial-at-tr": "radial-gradient(ellipse at top right, var(--tw-gradient-stops))",
        "gradient-radial-at-bl": "radial-gradient(ellipse at bottom left, var(--tw-gradient-stops))",
        "gradient-radial-at-br": "radial-gradient(ellipse at bottom right, var(--tw-gradient-stops))",
      },
      height: {
        150: "32rem",
        14: "3.5rem",
      },
      width: {
        80: "17rem",
        85: "21rem",
      },
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        black: {
          100: "#d0d1d3",
          200: "#a1a3a7",
          300: "#71757c",
          400: "#424750",
          500: "#131924",
          600: "#0f141d",
          700: "#0b0f16",
          800: "#080a0e",
          900: "#040507",
        },
        slate: {
          500: "#94a3b8",
          800: "#1e293b",
          700: "#1e293c",
          900: "#131924",
          950: "#131924",
          960: "#181e2b",
        },
        green: {
          500: "#00c8a4",
          950: "#049a81",
        },
        red: {
          500: "#df484c",
          950: "#f23645",
        },
      },
    },
  },

  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/aspect-ratio"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/line-clamp"),
    require("tailwind-scrollbar-hide"),
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".flex-2": {
          flex: "2",
        },
        ".flex-3": {
          flex: "3",
        },
      });
    }),
  ],
};
