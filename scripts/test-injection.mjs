import fs from 'fs';
import puppeteer from 'puppeteer';

const testDir = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\test-min-ext2';
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

fs.writeFileSync(
  testDir + '\\manifest.json',
  JSON.stringify({
    manifest_version: 3,
    name: 'Minimal Test Extension 2',
    version: '1.0.0',
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*'],
        js: ['content.js'],
        run_at: 'document_start',
      },
    ],
  })
);

fs.writeFileSync(
  testDir + '\\content.js',
  `console.log("!!! EXTENSION CONTENT SCRIPT ACTIVATED !!!");
   document.documentElement.setAttribute('data-ext-loaded', 'yes');`
);

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\min-profile-2',
  ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
  args: [
    `--disable-extensions-except=${testDir}`,
    `--load-extension=${testDir}`,
  ],
});

const page = await browser.newPage();
page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
await page.goto('https://example.com');
await new Promise((r) => setTimeout(r, 1000));
const loaded = await page.evaluate(() => document.documentElement.getAttribute('data-ext-loaded'));
console.log('Is extension loaded via DOM attribute?', loaded);
await browser.close();
