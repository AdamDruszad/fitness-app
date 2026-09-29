const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  console.log('Logging in...');
  await page.goto('http://localhost:5173/login');
  
  await page.type('input[type="email"]', 'test@test.com');
  await page.type('input[type="password"]', 'test');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  console.log('Navigated to:', page.url());

  if (!page.url().endsWith('/log')) {
    console.log('Navigating to /log...');
    await page.goto('http://localhost:5173/log', { waitUntil: 'networkidle0' });
  }
  
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log('BODY HTML LENGTH:', bodyHTML.length);
  
  // Wait a bit to see if any errors pop up
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
