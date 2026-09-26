import puppeteer from 'puppeteer';

const extPath = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dist-real';
const userDir = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dev-toggle-profile';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: userDir,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
});

const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto('chrome://extensions');
await new Promise((r) => setTimeout(r, 2000));

await page.screenshot({ path: 'tests/e2e/screenshots/debug_loaded_extension.png' });
console.log('Saved debug_loaded_extension.png');

const extInfo = await page.evaluate(() => {
  const mgr = document.querySelector('extensions-manager');
  const list = mgr ? mgr.shadowRoot.querySelector('extensions-item-list') : null;
  const items = list ? list.shadowRoot.querySelectorAll('extensions-item') : [];
  return Array.from(items).map((i) => ({
    name: i.shadowRoot.querySelector('#name')?.textContent,
    id: i.id,
    version: i.shadowRoot.querySelector('#version')?.textContent,
  }));
});

console.log('EXTENSIONS LOADED:', extInfo);

await browser.close();
