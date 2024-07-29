import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./**/*.templ"],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: ["light", "dark", "forest"],
  },
  plugins: [daisyui],
};
