/** @type {import('tailwindcss').Config} */
// Semantic layer (colors, radii, fonts, animations) comes from @ember/ui's preset,
// located via the workspace resolver — never a hardcoded path.
const fs = require('fs');
const path = require('path');
const findEis = (d) => {
  for (; d !== path.dirname(d); d = path.dirname(d)) {
    const p = path.join(d, 'eis-paths.cjs');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('eis-paths.cjs not found above ' + __dirname);
};
const eis = require(findEis(__dirname));

module.exports = {
  darkMode: 'class',
  presets: [require(eis.emberUiPreset)],
  content: eis.emberContentGlobs(__dirname, [
    path.join(__dirname, 'src/renderer/index.html'),
    path.join(__dirname, 'src/renderer/src/**/*.{js,jsx,ts,tsx}')
  ]),
  plugins: [require('tailwindcss-animate')]
};
