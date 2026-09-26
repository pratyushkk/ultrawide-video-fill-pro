import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dist = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dist';

console.log('Dist path:', dist);

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-test-profile',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
  ],
});

await new Promise((r) => setTimeout(r, 2000));

const targets = await browser.targets();
console.log('All browser targets:');
for (const t of targets) {
  console.log(` - type: ${t.type()}, url: ${t.url()}`);
}

await browser.close();
