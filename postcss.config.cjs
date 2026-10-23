// Absolute tailwind config path so it resolves regardless of the cwd the dev
// server/build is launched from.
const path = require('path');
module.exports = {
  plugins: {
    tailwindcss: { config: path.join(__dirname, 'tailwind.config.cjs') },
    autoprefixer: {}
  }
};
