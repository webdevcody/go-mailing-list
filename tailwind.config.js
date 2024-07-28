import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./components/**/*.templ", "./pages/**/*.templ"],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
};
