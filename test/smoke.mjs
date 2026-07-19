/**
 * Smoke test for the components — run with: node test/smoke.mjs
 *
 * For each component it checks:
 *   (a) both the primary and the legacy tag are defined
 *   (b) an element created from the legacy tag is an instance of the primary class
 *   (c) the property path works: framework-style property assignment reflects
 *       to the attribute (Vue/React set DOM properties, so a getter without a
 *       reflecting setter silently loses the assignment)
 *   (d) the source text uses --dardanialabs-* vars with --rtek-* fallback reads
 *       (footer has no themed CSS vars, so (d) applies to slider and mailform)
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');

const COMPONENTS = [
  { file: 'dardanialabs-footer.js', primary: 'dardanialabs-footer', legacy: 'rtek-footer', cssVars: false },
  { file: 'dardanialabs-photoslider.js', primary: 'dardanialabs-photoslider', legacy: 'rtek-photoslider', cssVars: true },
  { file: 'dardanialabs-mailform.js', primary: 'dardanialabs-mailform', legacy: 'rtek-mailform', cssVars: true },
];

// Shadow-root <style> text uses modern CSS (color-mix, nesting-ish constructs)
// that jsdom's CSS parser complains about; silence those non-fatal reports.
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://smoke.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole,
});
const { window } = dom;

const sources = new Map();
for (const c of COMPONENTS) {
  const code = await readFile(path.join(srcDir, c.file), 'utf8');
  sources.set(c.file, code);
  window.eval(code);
}

let failures = 0;
function check(label, fn) {
  let ok = false;
  let detail = '';
  try {
    ok = Boolean(fn());
  } catch (error) {
    detail = ` (${error.name}: ${error.message})`;
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : detail}`);
  if (!ok) failures += 1;
}

for (const c of COMPONENTS) {
  const source = sources.get(c.file);

  // (a) both tags defined
  check(`${c.primary}: primary tag is defined`, () => Boolean(window.customElements.get(c.primary)));
  check(`${c.primary}: legacy tag "${c.legacy}" is defined`, () => Boolean(window.customElements.get(c.legacy)));

  // (b) legacy element instanceof primary class
  check(`${c.primary}: legacy element instanceof primary class`, () => {
    const Primary = window.customElements.get(c.primary);
    const el = window.document.createElement(c.legacy);
    return el instanceof Primary;
  });

  // (d) source text: new vars present, old vars read as fallbacks
  if (c.cssVars) {
    check(`${c.primary}: source uses --dardanialabs-* vars`, () => source.includes('--dardanialabs-'));
    check(`${c.primary}: source keeps var(--rtek-*) fallback reads`, () => /var\(--dardanialabs-[a-z-]+, var\(--rtek-/.test(source));
  }
}

// (c) property path — photoslider .images accepts a real array and reflects
{
  const el = window.document.createElement('dardanialabs-photoslider');
  el.images = ['/img/a.jpg', '/img/b.jpg'];
  check('dardanialabs-photoslider: .images array reflects to attribute', () =>
    el.getAttribute('images') === JSON.stringify(['/img/a.jpg', '/img/b.jpg']));
  check('dardanialabs-photoslider: .images getter returns the array back', () =>
    Array.isArray(el.images) && el.images.length === 2 && el.images[1] === '/img/b.jpg');
  el.images = '["/img/c.jpg"]';
  check('dardanialabs-photoslider: .images JSON-string assignment also works', () =>
    el.getAttribute('images') === '["/img/c.jpg"]' && el.images[0] === '/img/c.jpg');
}

// (c) property path — mailform .lang and .api reflect
{
  const el = window.document.createElement('dardanialabs-mailform');
  el.lang = 'en';
  check('dardanialabs-mailform: .lang property reflects to attribute', () =>
    el.getAttribute('lang') === 'en' && el.lang === 'en');
  el.api = 'https://api.example.com/v1/public';
  check('dardanialabs-mailform: .api property reflects to attribute', () =>
    el.getAttribute('api') === 'https://api.example.com/v1/public' && el.api === 'https://api.example.com/v1/public');
  check('dardanialabs-mailform: default api base is dardanialabs.io', () => {
    const fresh = window.document.createElement('dardanialabs-mailform');
    return fresh.api === 'https://api.dardanialabs.io/v1/public';
  });
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
