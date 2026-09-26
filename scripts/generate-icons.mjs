import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcImage = 'C:/Users/PRATYUSH/.gemini/antigravity/brain/1a33f3d1-5943-4e8b-ae8a-e75e0e133597/.user_uploaded/media_1790444457806.jpg';

const publicIconsDir = path.resolve(rootDir, 'public/icons');
const distIconsDir = path.resolve(rootDir, 'dist/icons');

if (!fs.existsSync(publicIconsDir)) fs.mkdirSync(publicIconsDir, { recursive: true });
if (!fs.existsSync(distIconsDir)) fs.mkdirSync(distIconsDir, { recursive: true });

async function generate() {
  console.log('Loading source logo image from:', srcImage);
  const imgData = fs.readFileSync(srcImage);
  const base64Src = `data:image/jpeg;base64,${imgData.toString('base64')}`;

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const sizes = [16, 32, 48, 128, 512];

  for (const size of sizes) {
    const pngBase64 = await page.evaluate(async (src, targetSize) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetSize, targetSize);
          resolve(canvas.toDataURL('image/png').split(',')[1]);
        };
        img.src = src;
      });
    }, base64Src, size);

    const buffer = Buffer.from(pngBase64, 'base64');
    const filename = size === 512 ? 'logo.png' : `icon${size}.png`;

    const publicTarget = path.join(publicIconsDir, filename);
    const distTarget = path.join(distIconsDir, filename);

    fs.writeFileSync(publicTarget, buffer);
    fs.writeFileSync(distTarget, buffer);
    console.log(`✓ Generated ${filename} (${size}x${size})`);
  }

  await browser.close();
  console.log('All icons generated successfully!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
