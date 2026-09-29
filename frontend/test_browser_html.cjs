const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.type('input[type="email"]', 'adambiro2008@gmail.com');
  await page.type('input[type="password"]', 'test1234');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  if (!page.url().endsWith('/log')) {
    await page.goto('http://localhost:5173/log', { waitUntil: 'networkidle0' });
  }
  
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log(bodyHTML);
  
  await browser.close();
})();
