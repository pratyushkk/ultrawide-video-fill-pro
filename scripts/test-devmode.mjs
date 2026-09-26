import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const extPath = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dist';
const userDir = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-test-dev-profile';
const defaultDir = path.join(userDir, 'Default');

if (!fs.existsSync(defaultDir)) {
  fs.mkdirSync(defaultDir, { recursive: true });
}

// Enable developer mode in Preferences
fs.writeFileSync(
  path.join(defaultDir, 'Preferences'),
  JSON.stringify({
    extensions: {
      ui: {
        developer_mode: true,
      },
    },
  })
);

console.log('Created profile with Developer mode enabled.');

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: userDir,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
    '--no-first-run',
  ],
});

const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto('chrome://extensions', { waitUntil: 'networkidle2' }).catch(() => {});
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: 'tests/e2e/screenshots/debug_extensions_devmode.png' });
console.log('Saved debug_extensions_devmode.png');
await browser.close();
