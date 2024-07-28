import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./components/**/*.templ", "./pages/**/*.templ"],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: ["light", "dark", "forest"],
  },
  plugins: [daisyui],
};
