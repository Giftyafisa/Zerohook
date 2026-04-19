const { test, expect } = require('@playwright/test');
const routePacks = require('./ui-baseline.packs.json');

const DEFAULT_PROJECTS = ['chromium', 'Mobile Chrome'];
const selectedPackName = process.env.UI_BASELINE_PACK || 'public-core';
const defaultMaxDiffPixelRatio = Number.parseFloat(process.env.UI_BASELINE_MAX_DIFF_RATIO || '0.02');
const mobileMaxDiffPixelRatio = Number.parseFloat(process.env.UI_BASELINE_MAX_DIFF_RATIO_MOBILE || '0.05');

function parseProjectAllowList() {
  const envValue = process.env.UI_BASELINE_PROJECTS;
  if (!envValue) {
    return new Set(DEFAULT_PROJECTS);
  }

  const projects = envValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(projects.length > 0 ? projects : DEFAULT_PROJECTS);
}

function resolveSelectedPacks() {
  if (selectedPackName === 'all') {
    return Object.entries(routePacks);
  }

  const selectedPack = routePacks[selectedPackName];
  if (!selectedPack) {
    const knownPacks = Object.keys(routePacks).join(', ');
    throw new Error(`Unknown UI baseline pack: ${selectedPackName}. Known packs: ${knownPacks}`);
  }

  return [[selectedPackName, selectedPack]];
}

async function stabilizePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }

      [role="alert"],
      .Toastify,
      .MuiSnackbar-root {
        visibility: hidden !important;
      }
    `
  });

  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });

  await page.waitForTimeout(250);
}

const allowedProjects = parseProjectAllowList();
const selectedPacks = resolveSelectedPacks();

for (const [packName, pack] of selectedPacks) {
  test.describe(`ui-baseline:${packName}`, () => {
    for (const route of pack.routes) {
      test(`${packName}:${route.id}`, async ({ page }, testInfo) => {
        if (!allowedProjects.has(testInfo.project.name)) {
          test.skip(true, `Project ${testInfo.project.name} is excluded from UI baseline pack runs.`);
        }

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForLoadState('load');
        // Avoid relying on networkidle because realtime sockets can keep the network active.
        await page.waitForTimeout(800);
        await stabilizePage(page);

        const maxDiffPixelRatio = testInfo.project.name === 'Mobile Chrome'
          ? mobileMaxDiffPixelRatio
          : defaultMaxDiffPixelRatio;

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          return {
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth
          };
        });

        expect(
          overflow.scrollWidth,
          `Horizontal overflow detected on ${route.path}.`
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);

        await expect(page).toHaveScreenshot(`${packName}-${route.id}.png`, {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          maxDiffPixelRatio,
          timeout: 45000
        });
      });
    }
  });
}
