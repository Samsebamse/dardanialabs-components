/**
 * Checks for dardanialabs-richtext.js — run with: node test/richtext.mjs
 *
 * It lives beside smoke.mjs rather than inside it because the subject is a
 * different kind of file: the components are classic scripts that smoke.mjs
 * eval's into a jsdom window, while this is an ES module that has to be
 * imported. The import is dynamic so that globalThis.document is already the
 * jsdom document by the time the module is asked to build a node.
 *
 * The cases below are the ones that must never regress. Most of them are the
 * safety rules — a whitelist parser is only worth having if the whitelist is
 * provably closed — and the rest are the syntax decisions that separate this
 * from "some markdown": one <ul> per run of item lines, and a single newline
 * that is a space rather than a line break.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcFile = path.join(root, 'src', 'dardanialabs-richtext.js');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://smoke.test/' });
globalThis.document = dom.window.document;

const source = await readFile(srcFile, 'utf8');
const { toFragment, renderInto, CLASSES } = await import('../src/dardanialabs-richtext.js');

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

/** Render into a detached div so each case can query the result. */
const render = (text, options) => renderInto(dom.window.document.createElement('div'), text, options);

// ── Safety rule 1 — nothing a tenant types can become markup ──
{
	const host = render('Hello <script>alert(1)</script> world');
	check('a <script> payload renders as text, not as an element', () =>
		host.querySelector('script') === null && host.textContent.includes('<script>alert(1)</script>'));

	const attr = render('- <img src=x onerror=alert(1)>');
	check('an <img onerror> payload renders as text inside the item', () =>
		attr.querySelector('img') === null && attr.querySelector('li').textContent === '<img src=x onerror=alert(1)>');

	// Matched as a property access / assignment rather than as a bare word: the
	// header states the rule by name, so the word itself belongs in the file.
	check('the module source never touches innerHTML', () =>
		!/\.innerHTML\b/.test(source) && !/\binnerHTML\s*\+?=/.test(source));
}

// ── Safety rule 2 — a link target must be https:// ──
{
	const bad = render('[click me](javascript:alert(1))');
	check('a javascript: link renders as text, not as an anchor', () =>
		bad.querySelector('a') === null && bad.textContent.includes('[click me](javascript:alert(1))'));

	for (const href of ['data:text/html,<script>1</script>', '//evil.example/x', '/relative/path', 'http://plain.example']) {
		const el = render(`[x](${href})`);
		check(`a "${href}" link renders as text`, () => el.querySelector('a') === null && el.textContent.includes(href));
	}

	const good = render('[Read more](https://dardanialabs.io/docs)');
	check('an https:// link becomes an anchor with target and rel', () => {
		const a = good.querySelector('a');
		return a
			&& a.getAttribute('href') === 'https://dardanialabs.io/docs'
			&& a.getAttribute('target') === '_blank'
			&& a.getAttribute('rel') === 'noopener noreferrer'
			&& a.className === CLASSES.link
			&& a.textContent === 'Read more';
	});

	const upper = render('[x](HTTPS://dardanialabs.io)');
	check('the https:// test is case-insensitive', () => upper.querySelector('a') !== null);
}

// ── Lists — a run of item lines is ONE list ──
{
	const bullets = render('- Rehabilitering\n- Oppgraderinger\n- Vedlikeholdsarbeider');
	check('consecutive "- " lines produce exactly one <ul>', () => bullets.querySelectorAll('ul').length === 1);
	check('that <ul> holds one <li> per line', () => bullets.querySelectorAll('li').length === 3);
	check('list elements carry the documented classes', () =>
		bullets.querySelector('ul').className === CLASSES.bulletList
		&& bullets.querySelector('li').className === CLASSES.item);

	const stars = render('* One\n* Two');
	check('"* " lines are bullets too, in the same single <ul>', () =>
		stars.querySelectorAll('ul').length === 1 && stars.querySelectorAll('li').length === 2);

	const numbers = render('1. First\n2. Second\n10. Tenth');
	check('consecutive numbered lines produce one <ol> with every item', () =>
		numbers.querySelectorAll('ol').length === 1 && numbers.querySelectorAll('li').length === 3);

	const split = render('- One\n- Two\n\n- Three');
	check('a blank line between item runs starts a second <ul>', () => split.querySelectorAll('ul').length === 2);

	const mixed = render('Intro line\n- One\n- Two');
	check('prose followed by items gives one <p> and one <ul>', () =>
		mixed.querySelectorAll('p').length === 1 && mixed.querySelectorAll('ul').length === 1);
}

// ── Paragraphs — a single newline is a space, a blank line is a break ──
{
	const soft = render('first line\nsecond line');
	check('a single newline does not create a <br>', () => soft.querySelector('br') === null);
	check('a single newline becomes one space in one <p>', () =>
		soft.querySelectorAll('p').length === 1 && soft.querySelector('p').textContent === 'first line second line');

	const hard = render('first block\n\nsecond block');
	check('a blank line produces two <p> elements', () => hard.querySelectorAll('p').length === 2);
	check('paragraphs carry the documented class', () => hard.querySelector('p').className === CLASSES.paragraph);
}

// ── Emphasis, including inside a list item ──
{
	const item = render('- **Rehabilitering** av bygg');
	check('**bold** nests inside a list item', () => {
		const strong = item.querySelector('li > strong');
		return strong && strong.textContent === 'Rehabilitering' && item.querySelector('li').textContent === 'Rehabilitering av bygg';
	});

	const em = render('This is *important* text');
	check('*text* becomes <em>', () => em.querySelector('em')?.textContent === 'important');

	const both = render('**bold with *inner* emphasis**');
	check('emphasis nests inside bold', () => both.querySelector('strong > em')?.textContent === 'inner');

	const linked = render('- **[Docs](https://dardanialabs.io)**');
	check('a link nests inside bold inside a list item', () =>
		both.querySelector('strong') !== null && linked.querySelector('li > strong > a')?.textContent === 'Docs');
}

// ── Rule 3 — the legacy content degrades loudly, never silently ──
{
	const legacy = render('• Rehabilitering<br/>\n• Oppgraderinger<br/>\n• Vedlikeholdsarbeider<br/>');
	check('legacy "• x<br/>" produces no <br> element', () => legacy.querySelector('br') === null);
	check('legacy "• x<br/>" produces no list either — it is not list syntax', () =>
		legacy.querySelectorAll('ul, ol, li').length === 0);
	check('legacy "<br/>" survives as visible characters', () => legacy.textContent.includes('<br/>'));

	const glyph = render('◈ Entreprenør & Gjennomføring', { inline: true });
	check('a decorative glyph and a bare & pass through untouched', () =>
		glyph.textContent === '◈ Entreprenør & Gjennomføring');

	check('unknown syntax never throws', () => {
		for (const odd of ['****', '***', '[unclosed(https://x', '- ', '1.', '*', '](', null, undefined, 42, {}]) render(odd);
		return true;
	});
}

// ── The two entry points behave as documented ──
{
	const host = dom.window.document.createElement('div');
	host.appendChild(dom.window.document.createElement('span'));
	renderInto(host, 'fresh text');
	check('renderInto clears whatever the element held', () => host.querySelector('span') === null);
	check('renderInto stamps the wrapper class', () => host.classList.contains(CLASSES.wrapper));

	const heading = render('Hvorfor velge **Bymico**?', { inline: true });
	check('inline mode emits no <p> wrapper', () => heading.querySelector('p') === null);
	check('inline mode still formats emphasis', () => heading.querySelector('strong')?.textContent === 'Bymico');
	check('inline mode collapses newlines to spaces', () =>
		render('◈ Byggteknisk Rådgivning\n\n\n', { inline: true }).textContent === '◈ Byggteknisk Rådgivning');

	const fragment = toFragment('- a\n- b');
	check('toFragment returns a DocumentFragment of the blocks', () =>
		fragment.nodeType === dom.window.Node.DOCUMENT_FRAGMENT_NODE && fragment.childNodes.length === 1);

	check('empty input renders nothing at all', () => render('').childNodes.length === 0 && render(null).childNodes.length === 0);

	check('the API is published on the global for no-bundler sites', () =>
		typeof globalThis.dardanialabsRichtext?.renderInto === 'function'
		&& typeof globalThis.dardanialabsRichtext?.toFragment === 'function');
}

// ── The ordinal rule: a date at the start of a line is not a list ──
{
	// Norwegian writes dates exactly the way a numbered list starts, and this
	// is opening-hours text — the content the CMS help panel showcases.
	const date = render('14. august stenger vi kl 16.');
	check('a date line is prose, not a list', () => date.querySelector('ol') === null);
	check('a date keeps its own number', () =>
		date.textContent === '14. august stenger vi kl 16.');

	check('17. mai survives', () => render('17. mai holder vi stengt.').textContent === '17. mai holder vi stengt.');
	check('a date after a paragraph is still prose', () => {
		const mixed = render('Vi har åpent hver dag.\n\n24. desember: 09-14.');
		return mixed.querySelector('ol') === null && mixed.querySelectorAll('p').length === 2;
	});

	// The feature still has to work.
	check('a list starting at 1 is still a list', () => {
		const list = render('1. Befaring\n2. Rapport');
		return list.querySelectorAll('li').length === 2 && !list.querySelector('ol').hasAttribute('start');
	});
	check('the lazy "1. 1. 1." habit still numbers correctly', () => {
		const lazy = render('1. En\n1. To\n1. Tre');
		return lazy.querySelectorAll('ol').length === 1 && lazy.querySelectorAll('li').length === 3;
	});
	check('an open list swallows any number that follows', () =>
		render('1. En\n7. To').querySelectorAll('li').length === 2);

	// A tenant who puts air between items means one list, not three.
	check('a blank-line-separated list resumes instead of restarting', () => {
		const split = render('1. En\n\n2. To');
		const lists = split.querySelectorAll('ol');
		return lists.length === 2 && lists[1].getAttribute('start') === '2';
	});
	check('a number that resumes nothing is prose', () =>
		render('2. Rapport').querySelector('ol') === null);
	check('a year at the start of a line is prose', () =>
		render('2026. Et godt år.').querySelector('ol') === null);
}

// ── Headings ──
{
	const one = render('# Åpningstider');
	check('# becomes a heading', () => one.querySelector('h3')?.textContent === 'Åpningstider');
	check('# carries both the shared and the level class', () => {
		const h = one.querySelector('h3');
		return h.classList.contains(CLASSES.heading) && h.classList.contains(CLASSES.headingMajor);
	});

	const two = render('## Tjenester');
	check('## becomes the next level down', () => two.querySelector('h4')?.textContent === 'Tjenester');
	check('## carries the minor class', () =>
		two.querySelector('h4').classList.contains(CLASSES.headingMinor));

	check('headingBase moves both levels together', () => {
		const deep = render('# A\n\n## B', { headingBase: 4 });
		return deep.querySelector('h4')?.textContent === 'A' && deep.querySelector('h5')?.textContent === 'B';
	});
	check('headingBase never rises above the page-owned levels', () => {
		const shallow = render('# A', { headingBase: 1 });
		return shallow.querySelector('h1') === null && shallow.querySelector('h3')?.textContent === 'A';
	});
	check('headingBase never runs past h6', () => {
		const floor = render('## B', { headingBase: 9 });
		return floor.querySelector('h6')?.textContent === 'B';
	});
	check('a garbage headingBase falls back to the default', () =>
		render('# A', { headingBase: 'nonsense' }).querySelector('h3')?.textContent === 'A');

	check('###+ is not a heading', () => {
		const many = render('### Too deep');
		return many.querySelector('h3, h4, h5, h6') === null && many.textContent === '### Too deep';
	});
	check('a hashtag without a space stays literal', () => {
		const tag = render('#bymico er best');
		return tag.querySelector('h3') === null && tag.textContent === '#bymico er best';
	});
	check('a lone # is text, not an empty heading', () => {
		const bare = render('#');
		return bare.querySelector('h3') === null && bare.textContent === '#';
	});

	check('a heading formats inline syntax inside itself', () =>
		render('# Se **prisene**').querySelector('h3 strong')?.textContent === 'prisene');
	check('a heading closes the paragraph before it', () => {
		const mixed = render('Vi hjelper deg.\n# Tjenester');
		return mixed.querySelector('p')?.textContent === 'Vi hjelper deg.'
			&& mixed.querySelector('h3')?.textContent === 'Tjenester';
	});
	check('a heading closes the list before it, and the next list is its own', () => {
		const mixed = render('- a\n# Tittel\n- b');
		return mixed.querySelectorAll('ul').length === 2 && mixed.querySelectorAll('li').length === 2;
	});
	check('a heading is not swallowed into the paragraph after it', () => {
		const mixed = render('# Tittel\nBrødtekst her.');
		return mixed.querySelector('h3')?.textContent === 'Tittel'
			&& mixed.querySelector('p')?.textContent === 'Brødtekst her.';
	});
	check('inline mode never emits a heading element', () => {
		const inline = render('# Tittel', { inline: true });
		return inline.querySelector('h3') === null && inline.textContent === '# Tittel';
	});
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
