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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');

const COMPONENTS = [
  { file: 'dardanialabs-footer.js', primary: 'dardanialabs-footer', legacy: 'rtek-footer', cssVars: false },
  { file: 'dardanialabs-photoslider.js', primary: 'dardanialabs-photoslider', legacy: 'rtek-photoslider', cssVars: true },
  // A module, not a classic script: it imports the shared validators so the form
  // gates on exactly the rules the server gates on. Every site embedding it must
  // therefore use <script type="module">.
  { file: 'dardanialabs-mailform.js', primary: 'dardanialabs-mailform', legacy: 'rtek-mailform', cssVars: true, module: true },
  // Born after the rename — no legacy tag, and its vars need no --rtek fallback.
  { file: 'dardanialabs-spinner.js', primary: 'dardanialabs-spinner', legacy: null, cssVars: false },
  { file: 'dardanialabs-datepicker.js', primary: 'dardanialabs-datepicker', legacy: null, cssVars: false },
  { file: 'dardanialabs-timepicker.js', primary: 'dardanialabs-timepicker', legacy: null, cssVars: false },
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

// Classic components are eval'd into the jsdom window, exactly as a <script src>
// runs them. A module component cannot be eval'd — it is imported, with the
// jsdom globals already in place so customElements.define lands on the same
// registry the checks below read. Which of the two a component is matters: it
// is the difference between the script tag a site must write and a form that
// silently never appears.
const sources = new Map();
for (const c of COMPONENTS) {
  const code = await readFile(path.join(srcDir, c.file), 'utf8');
  sources.set(c.file, code);
  if (!c.module) window.eval(code);
}

const moduleComponents = COMPONENTS.filter((c) => c.module);
if (moduleComponents.length) {
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.customElements = window.customElements;
  for (const c of moduleComponents) {
    await import(pathToFileURL(path.join(srcDir, c.file)).href);
  }
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
  if (c.legacy) check(`${c.primary}: legacy tag "${c.legacy}" is defined`, () => Boolean(window.customElements.get(c.legacy)));

  // (b) legacy element instanceof primary class
  if (c.legacy) check(`${c.primary}: legacy element instanceof primary class`, () => {
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

// spinner: renders a ring and an accessible label
{
  const el = window.document.createElement('dardanialabs-spinner');
  el.setAttribute('label', 'Creating mailbox…');
  window.document.body.appendChild(el);
  check('dardanialabs-spinner: renders svg ring', () => Boolean(el.shadowRoot.querySelector('svg circle.arc')));
  check('dardanialabs-spinner: label lands as text, not markup', () =>
    el.shadowRoot.querySelector('.label')?.textContent === 'Creating mailbox…');
}

// mailform: the honeypot cannot be autofilled, still catches a bot that
// fills every input, and the payload key the server gates on is unchanged.
{
  const el = window.document.createElement('dardanialabs-mailform');
  window.document.body.appendChild(el);
  const q = (name) => el.shadowRoot.querySelector(`[name="${name}"]`);
  const hp = q('hp_field');

  check('dardanialabs-mailform: honeypot input is named hp_field and nothing is named company', () =>
    Boolean(hp) && !el.shadowRoot.querySelector('[name="company"]'));
  check('dardanialabs-mailform: honeypot starts readonly, so autofill will not write it', () =>
    Boolean(hp) && hp.hasAttribute('readonly'));

  hp.dispatchEvent(new window.Event('focus'));
  check('dardanialabs-mailform: focusing the honeypot lifts readonly (a typing bot still gets in)', () =>
    !hp.hasAttribute('readonly'));

  // A bot fills EVERY input, the honeypot included. Capture what gets POSTed.
  q('firstName').value = 'Sami';
  q('lastName').value = 'Rashiti';
  q('email').value = 'sami@example.com';
  q('message').value = 'A message long enough to pass the shared rules.';
  hp.value = 'Acme AS';

  // The component dispatches CustomEvents after a send; hand it jsdom's so
  // dispatchEvent recognises them.
  globalThis.CustomEvent = window.CustomEvent;

  let posted = null;
  const stubFetch = async (url, options) => {
    posted = JSON.parse(options.body);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = stubFetch;
  window.fetch = stubFetch;
  try {
    await el.submit();

    check('dardanialabs-mailform: the payload still carries the honeypot under `company`', () =>
      posted?.data?.company === 'Acme AS');
    check('dardanialabs-mailform: the payload has no hp_field key of its own', () =>
      Boolean(posted) && !('hp_field' in posted.data));

    // A human — autofill included — leaves the honeypot alone.
    posted = null;
    hp.value = '';
    await el.submit();
    check('dardanialabs-mailform: a clean submission sends company as the empty string', () =>
      posted?.data?.company === '');
  } finally {
    globalThis.fetch = realFetch;
    window.fetch = realFetch;
    el.remove(); // clears the post-send restore timer
  }
}

// mailform: declared fields travel as structured extras — [{ label, value }]
// in declaration order, code in front — and the message is the visitor's own
// words. The fold into the message body is gone: that is how a dropdown
// choice ended up glued to the first sentence of the mail.
{
  const el = window.document.createElement('dardanialabs-mailform');
  el.setAttribute('lang', 'no');
  el.setAttribute('require-code', '');
  el.setAttribute('fields', JSON.stringify([
    { name: 'service', label: 'Type tjeneste', type: 'select', options: ['Varmepumpe', 'Annet'], required: true },
    { name: 'onsket_dato', label: 'Ønsket dato', type: 'text' },
    { name: 'detaljer', label: 'Detaljer', type: 'text' }, // left empty on purpose
  ]));
  window.document.body.appendChild(el);
  const q = (name) => el.shadowRoot.querySelector(`[name="${name}"]`);
  q('firstName').value = 'Sami';
  q('lastName').value = 'Rashiti';
  q('email').value = 'sami@example.com';
  q('code').value = 'ABC12';
  q('x-service').value = 'Annet';
  q('x-onsket_dato').value = '12.09.2026';
  q('message').value = 'Er dette mottatt? Melding lang nok til å passere.';

  let posted = null;
  const stubFetch = async (url, options) => {
    posted = JSON.parse(options.body);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = stubFetch;
  window.fetch = stubFetch;
  try {
    await el.submit();

    check('dardanialabs-mailform: extras carry code + filled fields, labelled, in declaration order', () =>
      JSON.stringify(posted?.data?.extras) === JSON.stringify([
        { label: 'Kode', value: 'ABC12' },
        { label: 'Type tjeneste', value: 'Annet' },
        { label: 'Ønsket dato', value: '12.09.2026' },
      ]));
    check('dardanialabs-mailform: the message is the visitor\'s words only — nothing folded in', () =>
      posted?.data?.message === 'Er dette mottatt? Melding lang nok til å passere.');
    check('dardanialabs-mailform: flat field keys still ride for tenant validators', () =>
      posted?.data?.service === 'Annet' && posted?.data?.code === 'ABC12');
    check('dardanialabs-mailform: an empty optional field earns no extras row', () =>
      !posted.data.extras.some((x) => x.label === 'Detaljer'));
  } finally {
    globalThis.fetch = realFetch;
    window.fetch = realFetch;
    el.remove(); // clears the post-send restore timer
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
