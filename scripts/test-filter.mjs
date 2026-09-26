import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage();
  await page.goto('about:blank');
  const res = await page.evaluate(() => {
    let svg = document.getElementById('uwvf-svg-filters');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'uwvf-svg-filters';
      svg.setAttribute('style', 'position: absolute; width: 0; height: 0; pointer-events: none; overflow: hidden;');
      svg.innerHTML = `
        <defs>
          <filter id="uwvf-sharpness-filter" x="-10%" y="-10%" width="120%" height="120%">
            <feConvolveMatrix id="uwvf-matrix" order="3" preserveAlpha="true" kernelMatrix="0 -0.5 0 -0.5 3 -0.5 0 -0.5 0" />
          </filter>
        </defs>
      `;
      document.body.appendChild(svg);
    }

    const v = document.createElement('video');
    document.body.appendChild(v);

    const k = 0.6;
    const matrix = `0 -${k} 0 -${k} ${1 + 4*k} -${k} 0 -${k} 0`;
    const matrixEl = document.getElementById('uwvf-matrix');
    if (matrixEl) matrixEl.setAttribute('kernelMatrix', matrix);

    v.style.filter = 'url("#uwvf-sharpness-filter") contrast(1.15) brightness(1.03) saturate(1.25)';
    return {
      filter: window.getComputedStyle(v).filter,
      kernel: matrixEl?.getAttribute('kernelMatrix')
    };
  });
  console.log('Result:', res);
  await browser.close();
})();
