/**
 * dardanialabs-richtext.js — the one way CMS text becomes formatted markup.
 *
 * Tenant sites used to drop CMS values straight into a template string and
 * assign the result to innerHTML. That made every plain-text field a markup
 * field, and tenants noticed: they started typing their own pseudo-markup —
 * "• Item<br/>" — because it was the only way to get a list. Hand-made bullets
 * are not a list, so they cannot be styled, cannot be aligned, and cannot be
 * read out as a list by a screen reader; and the same door that let "<br/>"
 * through would let "<script>" through.
 *
 * This module closes that door and gives the tenants the feature they were
 * reaching for. It is a plain ES module — no custom element, no dependencies,
 * no build step — because the callers are both Vue components and no-bundler
 * classic scripts.
 *
 * Usage:
 *   import { renderInto, toFragment, CLASSES } from './dardanialabs-richtext.js';
 *   renderInto(cardBody, record.description);            // block: <p> / <ul> / <ol>
 *   renderInto(heading, record.title, { inline: true }); // inline only, no <p> wrapper
 *   node.appendChild(toFragment(record.description));    // build it yourself
 *
 *   // Sites with no bundler load this file with a module script tag and read
 *   // the same two functions off the global it publishes (see BOOTSTRAP below):
 *   //   <script type="module" src="…/dardanialabs-richtext.js?v=1.13.0"></script>
 *   //   window.dardanialabsRichtext.renderInto(el, text);
 *
 * Syntax — this table is the whole language. There is deliberately no more:
 *
 *   - item            consecutive lines → ONE <ul>, an <li> per line
 *   * item            the same (either marker, so both habits work)
 *   1. item           consecutive lines (any digits) → one <ol>
 *   # text            a heading, one step up in size  (<h3> by default)
 *   ## text           a smaller heading                (<h4> by default)
 *   (blank line)      ends the block; each block of prose becomes its own <p>
 *   (single newline)  a space inside the paragraph — NOT a line break
 *   **text**          <strong>
 *   *text*            <em>
 *   [label](https://…) <a target="_blank" rel="noopener noreferrer">
 *   anything else     literal text
 *
 * There is no way to set a size in points or pixels, and that is the design.
 * A tenant asking for "bigger text" wants a heading — something that reads as a
 * label for what follows. Handing out absolute sizes instead produces text that
 * is the wrong size on a phone, wrong again next to a heading the site already
 * has, and unstyleable the day the site is redesigned. The two levels here move
 * with the surface they land on and mean something to a search engine.
 *
 * Safety — three rules that make this a whitelist, not a sanitizer. A sanitizer
 * starts from "allow everything, then subtract the dangerous parts", which is a
 * list you can never finish. This starts from nothing and adds seven constructs:
 *
 *   1. innerHTML is NEVER used anywhere in this file. Every node comes from
 *      document.createElement and every character from textContent, so "<" is
 *      text BY CONSTRUCTION — a tenant typing "<script>" sees "<script>" as
 *      visible characters on the page. There is nothing to escape here, and
 *      therefore nothing an escaper could miss.
 *   2. A link target must start with "https://" (case-insensitive). Anything
 *      else — javascript:, data:, //evil.example, a relative path — is not a
 *      link at all: the whole "[label](…)" renders as literal text. Refusing to
 *      link is safe; guessing what a tenant meant by "javascript:" is not.
 *   3. Unknown syntax degrades to literal text — never to an error, never to a
 *      silent drop. That is also how the legacy content announces itself: an
 *      old "<br/>" now shows up as visible characters, which is the loudest
 *      possible hint that the field needs cleaning up. Content is never lost.
 *
 * Class names — every emitted element carries its own class from CLASSES below,
 * so a stylesheet never has to depend on an ancestor being present. renderInto
 * additionally stamps the wrapper class on the element it fills, which gives a
 * tenant one hook for the whole block. The mechanics that make a list read
 * correctly — markers outside, hanging indent, item rhythm — ship next door in
 * dardanialabs-richtext.css; a tenant themes it through the --dardanialabs-rt-*
 * custom properties without touching those mechanics.
 */

/** Class name on every element this module emits — the styling contract. */
export const CLASSES = {
	wrapper: 'dl-rt',      // stamped by renderInto on the element it fills
	paragraph: 'dl-rt-p',
	bulletList: 'dl-rt-ul',
	numberList: 'dl-rt-ol',
	item: 'dl-rt-li',
	link: 'dl-rt-link',
	heading: 'dl-rt-h',        // on every heading, whatever its level
	headingMajor: 'dl-rt-h1',  // #
	headingMinor: 'dl-rt-h2',  // ##
};

// A line is a list item only with a marker AND a space after it, so "*text*"
// at the start of a line stays emphasis instead of turning into a bullet.
const BULLET_LINE = /^[ \t]*[-*][ \t]+(.*)$/;
const NUMBER_LINE = /^[ \t]*\d+\.[ \t]+(.*)$/;

// Two heading levels, and deliberately no more: the tenant is labelling parts
// of one field, not building a document outline. The space after # is required
// for the same reason as above, so "#tag" stays a literal hashtag.
const HEADING_LINE = /^[ \t]*(#{1,2})[ \t]+(.*)$/;

// Where those two levels land in the page's own outline. A CMS field is
// rendered inside something that already has a title, so the default starts at
// h3 and a caller that sits deeper passes its own base. Headings never become
// h1 or h2: those belong to the page, and a service card minting a second h1
// would damage the outline every SEO tool reads.
const DEFAULT_HEADING_BASE = 3;
const MIN_HEADING_BASE = 3;
const MAX_HEADING_LEVEL = 6;

// The three inline constructs in one alternation, tried in this order so "**"
// wins over "*". Kept as a source string, not a RegExp: the scanner recurses
// (bold may hold a link) and a shared /g regex would have the inner call reset
// lastIndex under the outer one.
const INLINE_SOURCE = '\\*\\*([^\\n]+?)\\*\\*|\\*([^\\n*]+?)\\*|\\[([^\\]\\n]*)\\]\\(([^\\s()]*)\\)';

// Safety rule 2. Scheme-relative "//host" and relative paths fail this too,
// which is intended: a CMS field is not the place to build site navigation.
const SAFE_HREF = /^https:\/\//i;

// Nesting has no legitimate use past a couple of levels; the cap only exists so
// that a pathological string ends as literal text rather than as a stack blowup.
const MAX_DEPTH = 4;

const normalize = (text) => String(text ?? '').replace(/\r\n?/g, '\n');

/** Append `text` to `parent` as text nodes plus <strong>/<em>/<a>. */
const appendInline = (doc, parent, text, depth = 0) => {
	const source = String(text);
	if (depth > MAX_DEPTH) {
		parent.appendChild(doc.createTextNode(source));
		return;
	}
	const pattern = new RegExp(INLINE_SOURCE, 'g');
	let cursor = 0;
	let match;
	while ((match = pattern.exec(source)) !== null) {
		if (match.index > cursor) parent.appendChild(doc.createTextNode(source.slice(cursor, match.index)));
		const [whole, strong, em, label, href] = match;
		if (strong !== undefined) {
			const el = doc.createElement('strong');
			appendInline(doc, el, strong, depth + 1);
			parent.appendChild(el);
		} else if (em !== undefined) {
			const el = doc.createElement('em');
			appendInline(doc, el, em, depth + 1);
			parent.appendChild(el);
		} else if (SAFE_HREF.test(href)) {
			const el = doc.createElement('a');
			el.className = CLASSES.link;
			el.setAttribute('href', href);
			// New tab because these links leave the tenant's site; noopener so the
			// opened page can never reach back through window.opener.
			el.setAttribute('target', '_blank');
			el.setAttribute('rel', 'noopener noreferrer');
			appendInline(doc, el, label || href, depth + 1);
			parent.appendChild(el);
		} else {
			// Rule 2 + rule 3: a target we do not vouch for is printed exactly as
			// typed, so the tenant sees what they wrote and nothing is lost.
			parent.appendChild(doc.createTextNode(whole));
		}
		cursor = match.index + whole.length;
	}
	if (cursor < source.length) parent.appendChild(doc.createTextNode(source.slice(cursor)));
};

/** Append `text` to `target` as <p>/<ul>/<ol> blocks. */
const appendBlocks = (doc, target, text, headingBase = DEFAULT_HEADING_BASE) => {
	const base = Math.min(
		Math.max(Math.trunc(Number(headingBase)) || DEFAULT_HEADING_BASE, MIN_HEADING_BASE),
		MAX_HEADING_LEVEL,
	);
	const lines = normalize(text).split('\n');
	let list = null;      // the <ul>/<ol> currently accepting items
	let listTag = '';
	let prose = null;     // lines collecting into the paragraph currently open

	const closeParagraph = () => {
		if (!prose) return;
		const p = doc.createElement('p');
		p.className = CLASSES.paragraph;
		// Joined with a space, never a <br>: a newline in a CMS textarea is where
		// the box happened to wrap, not a decision about where the line ends.
		appendInline(doc, p, prose.join(' '));
		target.appendChild(p);
		prose = null;
	};

	for (const line of lines) {
		// A blank line is the one unambiguous "end of block" signal there is.
		if (!line.trim()) {
			closeParagraph();
			list = null;
			listTag = '';
			continue;
		}
		const headingParts = HEADING_LINE.exec(line);
		// A "#" with nothing after it is not a heading, it is a stray character;
		// letting it through would emit an empty heading the tenant cannot see.
		if (headingParts && headingParts[2].trim()) {
			closeParagraph();
			list = null;
			listTag = '';
			const minor = headingParts[1].length === 2;
			const level = Math.min(base + (minor ? 1 : 0), MAX_HEADING_LEVEL);
			const h = doc.createElement(`h${level}`);
			h.className = `${CLASSES.heading} ${minor ? CLASSES.headingMinor : CLASSES.headingMajor}`;
			appendInline(doc, h, headingParts[2].trim());
			target.appendChild(h);
			continue;
		}

		const bullet = BULLET_LINE.exec(line);
		const number = bullet ? null : NUMBER_LINE.exec(line);
		if (bullet || number) {
			closeParagraph();
			const tag = bullet ? 'ul' : 'ol';
			// Consecutive item lines join the open list; switching marker style
			// starts a new one, because that is a different list.
			if (!list || listTag !== tag) {
				list = doc.createElement(tag);
				list.className = bullet ? CLASSES.bulletList : CLASSES.numberList;
				listTag = tag;
				target.appendChild(list);
			}
			const li = doc.createElement('li');
			li.className = CLASSES.item;
			appendInline(doc, li, (bullet ? bullet[1] : number[1]).trim());
			list.appendChild(li);
			continue;
		}
		list = null;
		listTag = '';
		if (!prose) prose = [];
		prose.push(line.trim());
	}
	closeParagraph();
};

/** Parse `text` into a DocumentFragment. Options: `inline` skips the block
 *  layer, for headings and other places where a <p> would be wrong markup;
 *  `headingBase` is the level `#` becomes (default 3, floor 3) for a caller
 *  that renders deeper in the page than usual; `document` builds the nodes in
 *  another document (an iframe, a test DOM) instead of the ambient one. */
export const toFragment = (text, options = {}) => {
	const doc = options.document || globalThis.document;
	const fragment = doc.createDocumentFragment();
	if (options.inline) {
		// Every line becomes one run of text; blank lines carry no meaning in a
		// heading, so they collapse away rather than inventing a block.
		const oneLine = normalize(text).split('\n').map((line) => line.trim()).filter(Boolean).join(' ');
		appendInline(doc, fragment, oneLine);
	} else {
		appendBlocks(doc, fragment, text, options.headingBase);
	}
	return fragment;
};

/** Replace everything inside `element` with the parsed `text`. Returns the
 *  element, so a caller can build and place a node in one expression. */
export const renderInto = (element, text, options = {}) => {
	if (!element) return element;
	const doc = element.ownerDocument || globalThis.document;
	element.textContent = ''; // clears the children without going through innerHTML
	element.classList.add(CLASSES.wrapper);
	element.appendChild(toFragment(text, { ...options, document: doc }));
	return element;
};

// BOOTSTRAP — the tenant sites that have no bundler load their own index.js as a
// classic script, which cannot `import`. Loading this file with
// <script type="module" src=…> publishes the same API on the global instead, and
// module scripts run before window.onload, so it is in place when they render.
globalThis.dardanialabsRichtext = { toFragment, renderInto, CLASSES };
