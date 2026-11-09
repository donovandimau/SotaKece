#!/usr/bin/env node
// Real-Chromium check of a page that uses the Dimau Premium Shell.
//   node premium-shell/scripts/check-shell.mjs <url-or-file> [--json]
// Asserts at 390x844 and 1440x900: bottom nav fixed to the viewport bottom, every nav target >= 44px,
// no horizontal overflow, the search overlay opens, traps focus, closes on Escape and restores focus,
// and cumulative layout shift stays under 0.05 through load + nav + search open/close.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
// Playwright is resolved the CommonJS way so a machine-wide install (NODE_PATH) works without a package.json here.
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');

const target = process.argv[2];
if (!target) { console.error('usage: check-shell.mjs <url-or-file> [--json]'); process.exit(2); }
const url = /^https?:/.test(target) ? target : pathToFileURL(resolve(target)).href;
const json = process.argv.includes('--json');
const viewports = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }];
const report = { url, viewports: {}, ok: true };
const fail = (vp, msg) => { report.ok = false; (report.viewports[vp].failures ||= []).push(msg); };

const browser = await chromium.launch();
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const r = report.viewports[vp.name] = {};
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const nav = page.locator('[data-dps-nav]');
  if (await nav.count() !== 1) { fail(vp.name, 'exactly one [data-dps-nav] expected'); await page.close(); continue; }
  const box = await nav.boundingBox();
  r.nav = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
  if (Math.abs(box.y + box.height - vp.height) > (vp.width > 760 ? 24 : 1)) fail(vp.name, `nav not at viewport bottom (bottom edge ${Math.round(box.y + box.height)} of ${vp.height})`);
  const targets = await nav.locator('a,button').evaluateAll(els => els.map(el => { const b = el.getBoundingClientRect(); return { label: el.textContent.trim(), w: Math.round(b.width), h: Math.round(b.height) }; }));
  r.targets = targets;
  for (const t of targets) if (t.w < 44 || t.h < 44) fail(vp.name, `nav target "${t.label}" is ${t.w}x${t.h}, under 44px`);
  r.overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (r.overflow > 0) fail(vp.name, `horizontal overflow of ${r.overflow}px`);
  const active = await nav.locator('[aria-current="page"],[aria-pressed="true"]').count();
  if (active !== 1) fail(vp.name, `expected one active tab, found ${active}`);
  // Search overlay: open from the nav, type, keyboard, close, focus returns.
  const opener = page.locator('[data-dps-search-open]').first();
  if (await opener.count()) {
    await opener.focus(); await opener.press('Enter');
    const overlay = page.locator('[data-dps-search]');
    if (await overlay.isHidden()) fail(vp.name, 'search overlay did not open');
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-dps-search-input'));
    if (!focused) fail(vp.name, 'search input not focused on open');
    const panel = await page.locator('.dps-search-panel').boundingBox();
    r.search = panel && { x: Math.round(panel.x), y: Math.round(panel.y), w: Math.round(panel.width), h: Math.round(panel.height) };
    if (panel && (panel.x < 0 || panel.x + panel.width > vp.width)) fail(vp.name, 'search panel leaves the viewport');
    await page.keyboard.type('mu'); await page.waitForTimeout(350);
    r.results = await page.locator('[data-dps-search-results] [data-dps-result]').count();
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => !!document.activeElement.closest('[data-dps-search]'));
    if (!inside) fail(vp.name, 'focus escaped the search overlay');
    await page.keyboard.press('Escape');
    if (await overlay.isVisible()) fail(vp.name, 'Escape did not close the search overlay');
    const back = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-dps-search-open'));
    if (!back) fail(vp.name, 'focus did not return to the search opener');
  } else r.search = 'no opener on page';
  await page.waitForTimeout(200);
  r.cls = Number((await page.evaluate(() => window.__cls)).toFixed(4));
  if (r.cls >= 0.05) fail(vp.name, `cumulative layout shift ${r.cls} is over the 0.05 floor`);
  await page.close();
}
await browser.close();
if (json) console.log(JSON.stringify(report, null, 2));
else {
  for (const [name, r] of Object.entries(report.viewports)) {
    console.log(`${name}: nav ${r.nav ? `${r.nav.w}x${r.nav.h} at y=${r.nav.y}` : 'missing'} · targets ${r.targets ? r.targets.map(t => `${t.w}x${t.h}`).join(' ') : '-'} · overflow ${r.overflow}px · search ${typeof r.search === 'object' ? `${r.search.w}x${r.search.h}` : r.search} · results ${r.results ?? '-'} · CLS ${r.cls}`);
    for (const f of r.failures || []) console.log('  FAIL ' + f);
  }
  console.log(report.ok ? 'PASS' : 'FAIL');
}
process.exit(report.ok ? 0 : 1);
