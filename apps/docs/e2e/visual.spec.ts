import { test } from "@playwright/test";

test("visual tests", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  console.log("Home...");
  await page.goto("http://localhost:3000/getting-started");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "public/inheribase_home.png" });

  console.log("Opening search...");
  // The trigger has the text "Search documentation..."
  await page.click('button:has-text("Search documentation")');
  await page.waitForSelector('input[placeholder*="Search documentation"]', {
    timeout: 5000,
  });
  await page.screenshot({ path: "public/inheribase_search_open.png" });

  console.log("Typing nonsense for AI fallback...");
  await page.type(
    'input[placeholder*="Search documentation"]',
    "nonsense_query_test_ai"
  );
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "public/inheribase_ai_fallback.png" });

  console.log('Typing "what" for docs results...');
  const input = await page.$('input[placeholder*="Search documentation"]');
  await input.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type('input[placeholder*="Search documentation"]', "what");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "public/inheribase_docs_results.png" });
});
