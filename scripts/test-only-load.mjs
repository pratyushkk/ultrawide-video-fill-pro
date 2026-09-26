import puppeteer from 'puppeteer';

const extPath = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dist-real';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-only-load-profile',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--load-extension=${extPath}`,
  ],
});

const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto('chrome://extensions');
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: 'tests/e2e/screenshots/debug_only_load.png' });
console.log('Saved debug_only_load.png');
await browser.close();
