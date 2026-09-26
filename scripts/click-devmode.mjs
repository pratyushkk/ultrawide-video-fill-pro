import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dev-toggle-profile',
});

const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto('chrome://extensions');
await new Promise((r) => setTimeout(r, 1000));

// Click Developer mode toggle
const clicked = await page.evaluate(() => {
  const mgr = document.querySelector('extensions-manager');
  const toolbar = mgr ? mgr.shadowRoot.querySelector('extensions-toolbar') : null;
  const toggle = toolbar ? toolbar.shadowRoot.querySelector('#devMode') : null;
  if (toggle) {
    toggle.click();
    return true;
  }
  return false;
});

console.log('Clicked devMode toggle?', clicked);
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: 'tests/e2e/screenshots/debug_devmode_clicked.png' });
console.log('Saved debug_devmode_clicked.png');
await browser.close();
