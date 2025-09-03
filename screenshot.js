const { chromium } = require('playwright');

async function takeScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to a public website for demonstration
  await page.goto('https://example.com');
  
  // Take screenshot
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  
  await browser.close();
  console.log('Screenshot saved as screenshot.png');
}

takeScreenshot().catch(console.error);