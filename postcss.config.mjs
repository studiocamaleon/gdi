import path from "node:path";

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [path.join(process.cwd(), "scripts/postcss-heroui-scope.cjs")]: {},
  },
};

export default config;
