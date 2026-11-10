#!/usr/bin/env node
// Largest paint and layout shift for a signed-out visitor on a slow phone, as the lab measures it:
// 390x844 at 3x, 4x slower CPU, 1.6 Mbps down / 150 ms round trip. Prints the median of the runs.
//   node tests/tools/lcp-phone.mjs <url> [runs=3]
// Report only: it exits 0 whatever the numbers, so a slow network day never blocks a deploy.
import { chromium } from 'playwright';
const url = process.argv[2], runs = +(process.argv[3] || 3);
if (!url) { console.error('usage: lcp-phone.mjs <url> [runs]'); process.exit(2); }
const browser = await chromium.launch(), out = [];
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0; window.__el = '';
    new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__el = e.element ? e.element.tagName + (e.url ? ' ' + e.url.split('/').pop() : '') : ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'lcp-check=' + Date.now(), { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(4), el: window.__el, fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0) }));
  console.log(`run ${i + 1}: largest paint ${r.lcp} ms (${r.el}), first paint ${r.fcp} ms, layout shift ${r.cls}`);
  out.push(r); await ctx.close();
}
await browser.close();
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const lcp = med(out.map(r => r.lcp)), cls = med(out.map(r => r.cls));
console.log(`median of ${runs}: largest paint ${lcp} ms (target 2500), layout shift ${cls} (target 0.1)${lcp > 2500 ? ' — over target' : ''}`);
