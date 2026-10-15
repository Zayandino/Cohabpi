const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewport to a typical desktop size
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    console.log("Navigating to dashboard...");
    // Use domcontentloaded and shorter timeout to avoid Vite HMR WebSocket hangs
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait a brief moment for React rendering
    console.log("Waiting 4 seconds for React mounting...");
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Check if bottom nav exists
    const navExists = await page.$('#bottom-nav');
    if (navExists) {
      console.log("Bottom nav element FOUND in DOM.");
      
      const box = await navExists.boundingBox();
      console.log("Bounding box of BottomNav:", box);
      
      const isVisible = await page.evaluate(() => {
        const el = document.getElementById('bottom-nav');
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      console.log("Is visible by computed styles?", isVisible);

      const html = await page.evaluate(() => {
        const el = document.getElementById('bottom-nav');
        return el ? el.outerHTML : '';
      });
      console.log("HTML:", html);
      
    } else {
      console.log("Bottom nav element NOT FOUND in DOM.");
      const bodyHtml = await page.evaluate(() => document.body.innerHTML);
      console.log("BODY HTML snippet:", bodyHtml.substring(0, 1000) + "...");
    }
    
    // Save screenshot to disk
    await page.screenshot({ path: 'test_nav_screenshot.png' });
    console.log("Screenshot saved to test_nav_screenshot.png");
    
  } catch (err) {
    console.error("Error during test run:", err);
  } finally {
    await browser.close();
  }
})();
