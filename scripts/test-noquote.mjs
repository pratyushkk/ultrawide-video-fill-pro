import puppeteer from 'puppeteer';

// Exact path without any quotes or spaces
const extPath = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dist';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-clean-profile',
  ignoreDefaultArgs: true,
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
    '--remote-debugging-port=0',
  ],
});

await new Promise((r) => setTimeout(r, 2000));

const targets = await browser.targets();
console.log('ALL TARGETS:');
for (const t of targets) {
  console.log(` - [${t.type()}] ${t.url()}`);
}

const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto('chrome://extensions');
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: 'tests/e2e/screenshots/debug_noquote.png' });
console.log('Saved debug_noquote.png');

await browser.close();
