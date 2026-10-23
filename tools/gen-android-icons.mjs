/**
 * gen-android-icons.mjs — replace the stock Capacitor launcher icons with the app's real icon.
 * Regenerates BOTH legacy mipmaps (ic_launcher / ic_launcher_round, 48–192) AND the adaptive
 * foreground (ic_launcher_foreground, 108–432, icon padded into the safe zone) from build-assets/icon.png.
 * Adaptive background stays the existing @color/ic_launcher_background. Reusable across Capacitor apps.
 *
 *   node tools/gen-android-icons.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'build-assets', 'icon.png');
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const foreground = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const SAFE = 0.72; // icon occupies ~72% of the adaptive canvas; rest is safe-zone padding

for (const [d, size] of Object.entries(legacy)) {
  const dir = join(RES, `mipmap-${d}`);
  const buf = await sharp(SRC).resize(size, size, { fit: 'cover' }).png().toBuffer();
  await sharp(buf).toFile(join(dir, 'ic_launcher.png'));
  await sharp(buf).toFile(join(dir, 'ic_launcher_round.png'));
  console.log(`legacy  ${d}\t${size}x${size}`);
}
for (const [d, size] of Object.entries(foreground)) {
  const dir = join(RES, `mipmap-${d}`);
  const inner = Math.round(size * SAFE);
  const icon = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: icon, gravity: 'center' }])
    .png().toFile(join(dir, 'ic_launcher_foreground.png'));
  console.log(`fg      ${d}\t${size}x${size} (icon ${inner})`);
}
console.log('done — regenerated launcher icons from', SRC);
