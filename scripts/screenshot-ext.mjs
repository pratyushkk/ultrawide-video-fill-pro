import puppeteer from 'puppeteer';

const extPath = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dist';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-test-user-profile-2',
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
await page.screenshot({ path: 'tests/e2e/screenshots/debug_extensions_page.png' });
console.log('Saved debug_extensions_page.png');
await browser.close();
