const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  // Set local storage token so we don't redirect to login
  await page.goto('http://localhost:5173/login');
  await page.evaluate(() => {
    localStorage.setItem('token', 'dummy');
  });

  console.log('Navigating to /log...');
  await page.goto('http://localhost:5173/log', { waitUntil: 'networkidle0' });
  
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log('BODY HTML LENGTH:', bodyHTML.length);
  
  await browser.close();
})();
