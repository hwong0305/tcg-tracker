import { chromium } from "playwright";

export async function scrapeOnce(url: string, headers: Record<string, string>) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: headers["user-agent"],
      extraHTTPHeaders: headers
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    return { ok: true, payload: { url } };
  } catch {
    return { ok: false };
  } finally {
    await browser.close();
  }
}
