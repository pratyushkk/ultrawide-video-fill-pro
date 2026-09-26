import puppeteer from 'puppeteer';

const dist = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dist';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir: 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-profile-debug',
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-sandbox',
  ],
});

const page = await browser.newPage();
await page.goto('chrome://version');
const cmdLine = await page.evaluate(() => {
  return document.getElementById('command_line')?.textContent;
});
console.log('CHROME COMMAND LINE:', cmdLine);

await new Promise((r) => setTimeout(r, 2000));
await browser.close();
