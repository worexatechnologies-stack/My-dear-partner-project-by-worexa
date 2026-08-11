import { test } from '@playwright/test';

test.use({
  video: 'on',
  viewport: { width: 1280, height: 720 },
});

test('Record Website Walkthrough Video', async ({ page }) => {
  // Increase test timeout for full 60-90s video recording
  test.setTimeout(120000);
  page.setDefaultTimeout(30000);

  console.log('1. Navigating to Homepage...');
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);

  // Smooth scroll down homepage
  console.log('Scrolling Homepage...');
  await page.evaluate(async () => {
    const distance = 400;
    const delay = 1500;
    while (document.documentElement.scrollTop + window.innerHeight < document.documentElement.scrollHeight) {
      window.scrollBy(0, distance);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  });
  await page.waitForTimeout(2000);

  // Scroll back top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);

  // 2. About Page
  console.log('2. Navigating to About Page...');
  await page.goto('http://localhost:3000/about');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    window.scrollBy(0, 500);
  });
  await page.waitForTimeout(2500);

  // 3. Success Stories Page
  console.log('3. Navigating to Success Stories...');
  await page.goto('http://localhost:3000/success-stories');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    window.scrollBy(0, 500);
  });
  await page.waitForTimeout(2500);

  // 4. Contact Page
  console.log('4. Navigating to Contact Page...');
  await page.goto('http://localhost:3000/contact');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);

  // Demonstrate input field focus
  const inputs = await page.$$('input, textarea');
  for (const input of inputs.slice(0, 3)) {
    try {
      await input.focus();
      await page.waitForTimeout(1000);
    } catch {}
  }
  await page.waitForTimeout(2000);

  // 5. FAQ Page
  console.log('5. Navigating to FAQ Page...');
  await page.goto('http://localhost:3000/faq');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  
  // Click first button/accordion if available
  const accordionButtons = await page.$$('button');
  if (accordionButtons.length > 0) {
    try {
      await accordionButtons[0].click();
      await page.waitForTimeout(1500);
    } catch {}
  }
  await page.waitForTimeout(2000);

  // 6. Return to Homepage
  console.log('6. Returning to Homepage...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
});
