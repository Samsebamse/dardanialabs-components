/**
 * DardaniaLabs Sidebar Web Component
 * The webmail's left column, as one element any product can carry: the lockup
 * on top, the account under it, the product's own links, a row of tools at
 * the foot, and the two ways it gets out of the page's way.
 *
 *   A wide screen folds it to icons with the crimson tab on its edge. Folding
 *   fades the name and leaves the D where it stands, on the folded rail's
 *   centre line, drawing itself in again. The choice is remembered per
 *   browser, one for wide windows and one for narrow ones (under 1200px,
 *   folded until opened), as the webmail does.
 *
 *   A phone keeps the page the whole width. The column waits past the left
 *   edge until <dardanialabs-sidebar-button> (the D with a small arrow after
 *   it, at the top left of the page) opens it over the page, under a scrim.
 *   The drawer's D stands exactly where the button's does, so it opens around
 *   a D that stays put while the name grows out of it; the arrow after the
 *   name, turned round, closes it again, as do the scrim, the D itself, a
 *   link chosen and Escape. A link that opens something over the drawer or
 *   switches something in place (a menu, the theme) leaves it open when it,
 *   or what holds it, carries data-dardanialabs-sidebar-keep. Closing plays
 *   the opening back.
 *
 * Usage:
 *   <dardanialabs-sidebar account="name@example.com" remember="panel">
 *     <a class="sidebar-item" href="/overview" title="Overview">
 *       <span class="sidebar-icon"><svg>…</svg></span>
 *       <span class="sidebar-label">Overview</span>
 *     </a>
 *     <a slot="account" href="/replies">a short line under the address</a>
 *     <div slot="drawer">shown in a phone's drawer only, under the account</div>
 *     <a slot="foot" class="sidebar-tool" href="/settings">
 *       <span class="sidebar-icon"><svg>…</svg></span>
 *       <span class="sidebar-label">Settings</span>
 *     </a>
 *   </dardanialabs-sidebar>
 *
 *   <header style="height: var(--dardanialabs-sidebar-bar)">   (phones only)
 *     <dardanialabs-sidebar-button></dardanialabs-sidebar-button>
 *   </header>
 *
 * The links stay in the page, where a framework's router can own them; they
 * are styled by a sheet this script adds once, scoped to the element. A link
 * is selected with class "active" or aria-current="page" (vue-router and most
 * others set one of the two). A product with links of its own markup (the
 * webmail's) slots them as they are and styles them itself; the default slot
 * lays its children out as a column, so one of them can take the height
 * that is left (flex: 1) and scroll inside itself.
 *
 * Whatever is slotted as "account" stands under the address, a line beside
 * the initial (the webmail's "Auto-reply is on"); folded, it goes and a dot
 * on the initial keeps saying there is something.
 *
 * Attributes (each also a property, for frameworks that set properties):
 *   account       the address under the lockup; none, no account line
 *   remember      a key for keeping the wide screen's fold in localStorage
 *   phone-max     the widest window that counts as a phone, px (default 767)
 *   collapsed     folded to icons, on a wide screen (reflected)
 *   open          the drawer open, on a phone (reflected)
 *   fold-label, unfold-label, close-label
 *                 words for the controls (default English)
 *
 * The element also marks itself `phone` while the window is a phone's.
 *
 * What it tells the page:
 *   --dardanialabs-sidebar-width on <html>: the column's width beside the page
 *     (252px open, 64px folded, 0 on a phone), for the page's own margin.
 *   dardanialabs-sidebar-change event, detail { collapsed, open, phone }.
 *   While the drawer is open, elements carrying data-dardanialabs-sidebar-page
 *   are inert, so the keyboard cannot wander under the scrim, and the page
 *   does not scroll.
 *
 * Theming (custom properties, inherited; defaults are the webmail's dark):
 *   --dardanialabs-sidebar-bg, -line, -text, -text-hi, -hover, -selected
 *   --dardanialabs-sidebar-initial   the account's initial (default the hot accent)
 *   --dardanialabs-sidebar-note      the dot of a folded account line (default green)
 *   --dardanialabs-accent, --dardanialabs-accent-hot
 *   --dardanialabs-sidebar-bar   the phone's top bar height (default 56px)
 * The element sets no font of its own: the page's, inherited from where the
 * element stands, is the column's and its links'.
 */

(() => {
  const OPEN = 252;     // the webmail's 18rem on its 14px root
  const CLOSED = 64;    // 4.6rem
  const NARROW = 1200;  // under this, a wide screen starts folded

  // The D's strokes on a 100-unit canvas; the arrow on the D's own canvas,
  // three fifths of the D's height (whose ink runs 5 to 91) on its middle line
  const D = '<path class="mark-l" pathLength="100" d="M32 12 V84 H58"/>'
    + '<path class="mark-c" pathLength="100" d="M32 12 H56 Q88 12 88 47 Q88 84 58 84"/>';
  const ARROW = '<svg class="arrow" viewBox="0 0 22.29 100" focusable="false" aria-hidden="true">'
    + '<polygon points="0,22.2 9.39,22.2 22.29,48 9.39,73.8 0,73.8 12.9,48"/></svg>';

  const vars = `
    --bg: var(--dardanialabs-sidebar-bg, #121216);
    --line: var(--dardanialabs-sidebar-line, #33333d);
    --text: var(--dardanialabs-sidebar-text, #9b9ba6);
    --text-hi: var(--dardanialabs-sidebar-text-hi, #f2f2f4);
    --hover: var(--dardanialabs-sidebar-hover, #1a1a20);
    --selected: var(--dardanialabs-sidebar-selected, #22222a);
    --accent: var(--dardanialabs-accent, #d42b2b);
    --accent-hot: var(--dardanialabs-accent-hot, #ff4444);
    --initial: var(--dardanialabs-sidebar-initial, var(--accent-hot));
    --note: var(--dardanialabs-sidebar-note, #3fb864);
    --bar: var(--dardanialabs-sidebar-bar, 56px);
  `;

  // ---- The links, in the page: one sheet, scoped to the element --------------
  // Gmail's pills, running off the column's left edge; folded, each icon alone
  // in its pill on the rail's centre line. The tools at the foot: icon over
  // label, a row of tiles; folded, a stack of icons.
  // Every rule says what a page's own link rules might otherwise add (a
  // transition on every property, a glow on hover): the pills move with the
  // column, not after it.
  const PAGE_CSS = `
dardanialabs-sidebar .sidebar-item {
  display: flex; align-items: center; gap: 14px;
  height: 40px; margin: 0 10.5px 0 0; padding: 0 17.5px;
  border-radius: 0 20px 20px 0;
  color: var(--dardanialabs-sidebar-text, #9b9ba6);
  font: inherit; font-size: 14px; line-height: 40px; text-align: left;
  text-decoration: none; text-shadow: none; white-space: nowrap; overflow: hidden;
  background: none; border: 0; cursor: pointer; box-sizing: border-box;
  width: calc(100% - 10.5px); transition: none;
}
dardanialabs-sidebar .sidebar-item:hover,
dardanialabs-sidebar .sidebar-item:focus-visible {
  color: var(--dardanialabs-sidebar-text-hi, #f2f2f4);
  background: var(--dardanialabs-sidebar-hover, #1a1a20);
  text-shadow: none; outline: none;
}
dardanialabs-sidebar .sidebar-item:focus-visible,
dardanialabs-sidebar .sidebar-tool:focus-visible {
  box-shadow: inset 0 0 0 2px var(--dardanialabs-accent-hot, #ff4444);
}
dardanialabs-sidebar .sidebar-item.active,
dardanialabs-sidebar .sidebar-item[aria-current="page"],
dardanialabs-sidebar .sidebar-tool.active,
dardanialabs-sidebar .sidebar-tool[aria-current="page"] {
  color: var(--dardanialabs-sidebar-text-hi, #f2f2f4);
  font-weight: 600;
  background: var(--dardanialabs-sidebar-selected, #22222a);
}
dardanialabs-sidebar .sidebar-icon {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  min-width: 21px; line-height: 1;
}
dardanialabs-sidebar .sidebar-label { overflow: hidden; text-overflow: ellipsis; }

dardanialabs-sidebar[collapsed]:not([phone]) .sidebar-item {
  justify-content: center; gap: 0; width: calc(100% - 15.4px);
  margin: 0 7.7px; padding: 0; border-radius: 20px;
}
dardanialabs-sidebar[collapsed]:not([phone]) .sidebar-item .sidebar-label { display: none; }

dardanialabs-sidebar .sidebar-tool {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  gap: 2px; min-width: 0; margin: 4.9px 2.1px 0; padding: 7.7px 0 6px;
  border-radius: 8.4px; color: var(--dardanialabs-sidebar-text, #9b9ba6);
  font: inherit; line-height: 1; text-decoration: none; text-shadow: none;
  background: none; border: 0; cursor: pointer; transition: none;
}
dardanialabs-sidebar .sidebar-tool:hover,
dardanialabs-sidebar .sidebar-tool:focus-visible {
  color: var(--dardanialabs-sidebar-text-hi, #f2f2f4);
  background: var(--dardanialabs-sidebar-hover, #1a1a20);
  text-shadow: none; outline: none;
}
dardanialabs-sidebar .sidebar-tool .sidebar-label {
  max-width: 100%; font-size: 10px; line-height: 1.15; text-align: center;
  white-space: normal; overflow-wrap: break-word;
}
dardanialabs-sidebar[collapsed]:not([phone]) .sidebar-tool {
  flex: none; justify-content: center; height: 40px; margin: 0 7.7px; padding: 0;
}
dardanialabs-sidebar[collapsed]:not([phone]) .sidebar-tool .sidebar-label { display: none; }

/* A phone's drawer: rows at the touch minimum (44px), the tools taller */
dardanialabs-sidebar[phone] .sidebar-item {
  height: 44.1px; line-height: 44.1px; border-radius: 0 22.05px 22.05px 0;
}
dardanialabs-sidebar[phone] .sidebar-tool {
  gap: 2.8px; height: 54.6px; margin: 4.2px 2.1px 0; padding: 7.7px 0 0; box-sizing: border-box;
}
`;

  function addPageSheet() {
    if (document.getElementById('dardanialabs-sidebar-style')) return;
    const style = document.createElement('style');
    style.id = 'dardanialabs-sidebar-style';
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
  }

  // ---- The column itself ------------------------------------------------------
  const COLUMN_CSS = `
:host {
  ${vars}
  position: fixed; top: 0; bottom: 0; left: 0; z-index: 100;
  display: block; width: ${OPEN}px;
  color: var(--text-hi);
}
:host([collapsed]:not([phone])) { width: ${CLOSED}px; }
:host([ready]:not([phone])) { transition: width .2s ease; }

.column {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--bg); border-right: 1px solid var(--line);
  overflow: hidden; box-sizing: border-box;
}

/* The lockup: its canvas is 560 x 120 and draws the D's ink at x 31-101 and
   y 15-101, so the D's middle is 66 units in and 58 down. --lock-h sizes it
   and --d-x places that middle: on the folded rail's centre line here. */
.head {
  --lock-h: 52.5px; --d-x: ${CLOSED / 2}px;
  position: relative; flex: none; display: flex; align-items: center;
  height: ${CLOSED}px; overflow: hidden;
}
.lockup { display: block; flex: none; margin-left: calc(var(--d-x) - 66 * var(--lock-h) / 120); }
.lockup svg { display: block; height: var(--lock-h); width: auto; overflow: visible; }
.lockup path { fill: none; stroke-width: 14; stroke-dasharray: 100; stroke-dashoffset: 0; }
.mark-l { stroke: var(--accent); }
.mark-c { stroke: var(--text-hi); }
.word { fill: var(--text-hi); font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
.word-l { fill: var(--accent); }
.back { display: none; }

/* The account: an initial on the same centre line as the D, then the address */
.account {
  flex: none; display: flex; align-items: center; gap: 9.8px;
  height: 40px; padding: 0 10.5px 0 calc(var(--d-x, ${CLOSED / 2}px) - 13.3px);
  overflow: hidden; white-space: nowrap; color: var(--text-hi); cursor: default;
  --d-x: ${CLOSED / 2}px;
}
.account[hidden] { display: none; }
.initial {
  position: relative;
  flex: none; display: flex; align-items: center; justify-content: center;
  width: 26.6px; height: 26.6px; border-radius: 50%;
  font-size: 12.6px; font-weight: 700;
  color: var(--initial); background: color-mix(in srgb, var(--initial) 16%, transparent);
}
.mail { overflow: hidden; text-overflow: ellipsis; font-size: 13.3px; font-weight: 500; }

/* A line under the address: the two share the initial's height, the initial
   beside both. Folded, the line goes (and out of the keyboard's way), and a
   dot on the initial keeps saying it. */
.note { display: none; }
.account.noted {
  display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto;
  align-content: center; column-gap: 9.8px;
}
.account.noted .initial { grid-row: 1 / span 2; align-self: center; }
.account.noted .mail { grid-column: 2; line-height: 1.25; }
.account.noted .note { display: block; grid-column: 2; min-width: 0; overflow: hidden; }
:host([collapsed]:not([phone])) .note { visibility: hidden; transition: opacity .15s ease, visibility 0s linear .15s; }
:host([collapsed]:not([phone])) .account.noted .initial::after {
  content: ""; position: absolute; top: -.7px; right: -.7px;
  width: 7.7px; height: 7.7px; border-radius: 50%;
  background: var(--note); box-shadow: 0 0 0 2px var(--bg);
}

.drawer { display: none; }
.body {
  flex: 1; min-height: 0; padding: 8px 0;
  overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column;
}
.foot {
  flex: none; display: flex; height: 60.2px; padding: 0 7px; margin: 4.2px 0;
  border-top: 1px solid var(--line); box-sizing: border-box;
}
.foot:not(.filled) { display: none; }
:host([collapsed]:not([phone])) .foot { height: auto; }
:host([phone]) .foot { height: auto; margin: 4.2px 0 5.6px; }

/* Folded: the name and the address fade out quicker than the column closes,
   gone before its edge reaches them; the D draws itself in again, where it is
   (only as it folds: a page opening folded just has it) */
.word, .mail, .note { transition: opacity .3s ease .1s; }
:host([collapsed]:not([phone])) .word,
:host([collapsed]:not([phone])) .mail,
:host([collapsed]:not([phone])) .note { opacity: 0; }
:host([collapsed]:not([phone])) .word,
:host([collapsed]:not([phone])) .mail { transition: opacity .15s ease; }
:host([folding][collapsed]:not([phone])) .lockup path { animation: draw .7s cubic-bezier(.5, 0, .2, 1) both; }
:host([folding][collapsed]:not([phone])) .lockup .mark-c { animation-delay: .18s; }
:host([collapsed]:not([phone])) .foot { flex-direction: column; padding: 4px 0 0; }

@keyframes draw { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
@keyframes undraw { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 100; } }

/* The tab on the column's edge: 30 x 60, centred on it and half over it,
   widening under the pointer; the chevron turns, slower than the column moves */
.toggle {
  position: absolute; z-index: 5; top: 50%; left: 100%;
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 60px; margin: -30px 0 0 -15px; padding: 0;
  border: 0; border-radius: 0 8px 8px 0; color: #fff;
  background: var(--accent); box-shadow: 2px 0 8px rgba(0, 0, 0, .3); cursor: pointer;
  transition: background-color .3s ease, width .3s ease, margin .3s ease;
}
.toggle::before {
  content: ""; width: 9px; height: 9px; margin-left: 4px;
  border-left: 2px solid currentColor; border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform .45s cubic-bezier(.5, 0, .2, 1), margin .45s cubic-bezier(.5, 0, .2, 1);
}
:host([collapsed]) .toggle::before { margin-left: -4px; transform: rotate(-135deg); }
.toggle:hover { width: 35px; margin-left: -17px; }
.toggle:hover, .toggle:focus-visible { background: var(--accent-hot); }
.toggle:focus-visible { outline: 2px solid var(--accent-hot); outline-offset: 2px; }

.scrim { display: none; }

/* ---- The phone's drawer --------------------------------------------------- */
:host([phone]) { width: min(${OPEN}px, calc(100vw - 56px)); pointer-events: none; }
:host([phone]) .toggle { display: none; }
:host([phone]) .column {
  transform: translateX(-100%); visibility: hidden; box-shadow: none;
}
:host([phone][ready]) .column {
  transition: transform .25s ease .12s, box-shadow .25s ease .12s, visibility 0s linear .37s;
}
:host([phone][open]) .column {
  transform: none; visibility: visible; pointer-events: auto;
  box-shadow: 4px 0 18px rgba(0, 0, 0, .28);
  transition: transform .25s ease, box-shadow .25s ease, visibility 0s;
}

/* The header as tall as the page's bar, the D's middle 25px in, where the
   menu button draws its own, at the same size */
:host([phone]) .head { --lock-h: 44.8px; --d-x: 25px; height: var(--bar); }
:host([phone]) .account { --d-x: 25px; }
:host([phone]) .lockup { cursor: pointer; }
:host([phone]) .drawer { display: block; }

/* The arrow after the name's last letter (--word-end, in the lockup's units),
   on the D's middle line: the button runs the header's height and centres
   the arrow's canvas, the D's, as the lockup is centred. It starts after the
   name, never over its last letters, its ink 30 units clear of it. */
:host([phone]) .back {
  display: flex; position: absolute; top: 0; bottom: 0;
  left: calc(var(--d-x) - 66 * var(--lock-h) / 120 + (var(--word-end, 488) + 10) * var(--lock-h) / 120);
  align-items: center; padding: 0 1.5rem 0 calc(20 * var(--lock-h) / 120);
  background: none; border: 0; color: var(--text-hi); cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.back svg {
  display: block; width: calc(22.29 * var(--lock-h) / 120); height: calc(100 * var(--lock-h) / 120);
  transform: rotate(180deg); transform-origin: 50% 48%;
  transition: transform .45s cubic-bezier(.5, 0, .2, 1) .1s;
}
.back polygon { fill: currentColor; }
.back:focus-visible { outline: 2px solid var(--accent-hot); outline-offset: -2px; border-radius: 6px; }

:host([phone]) .scrim {
  display: block; position: fixed; inset: 0; z-index: -1;
  background: rgba(0, 0, 0, .45); opacity: 0;
  transition: opacity .25s ease .12s;
}
:host([phone][open]) .scrim { opacity: 1; pointer-events: auto; transition: opacity .25s ease; }

/* Opening: the D draws itself in where the button's stood, the name and the
   address fade in beside it and the arrow turns round. Closing plays it back. */
:host([phone][open]) .lockup path { animation: draw .7s cubic-bezier(.5, 0, .2, 1) both; }
:host([phone][open]) .lockup .mark-c { animation-delay: .18s; }
:host([phone]:not([open])) .lockup path { animation: undraw .3s cubic-bezier(.5, 0, .2, 1) both; }
:host([phone]:not([open])) .lockup .mark-l { animation-delay: .08s; }
:host([phone]:not([open])) .word,
:host([phone]:not([open])) .mail,
:host([phone]:not([open])) .note { opacity: 0; transition: opacity .2s ease; }
:host([phone]:not([open])) .back { opacity: 0; transition: opacity .15s ease .15s; }
:host([phone]:not([open])) .back svg { transform: none; transition: transform .25s cubic-bezier(.5, 0, .2, 1); }

@media (prefers-reduced-motion: reduce) {
  :host, .column, .scrim, .word, .mail, .note, .back, .back svg, .toggle, .toggle::before { transition: none !important; }
  .lockup path { animation: none !important; }
}
`;

  const boolAttr = (el, name, on) => (on ? el.setAttribute(name, '') : el.removeAttribute(name));

  class DardaniaLabsSidebar extends HTMLElement {
    static get observedAttributes() {
      return ['account', 'collapsed', 'open', 'phone-max', 'fold-label', 'unfold-label', 'close-label'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._onKeydown = this._onKeydown.bind(this);
      this._onPhoneChange = this._onPhoneChange.bind(this);
      this._onResize = this._onResize.bind(this);
      this._foldingTimer = null;
      this._resizeFrame = 0;
      this._narrow = null;
      this._locked = false;
    }

    // Properties for frameworks that set properties; each reflects to its attribute
    get account() { return this.getAttribute('account') || ''; }
    set account(v) { v ? this.setAttribute('account', v) : this.removeAttribute('account'); }
    get remember() { return this.getAttribute('remember') || ''; }
    set remember(v) { v ? this.setAttribute('remember', v) : this.removeAttribute('remember'); }
    get collapsed() { return this.hasAttribute('collapsed'); }
    set collapsed(v) { boolAttr(this, 'collapsed', v); }
    get open() { return this.hasAttribute('open'); }
    set open(v) { boolAttr(this, 'open', v); }
    get phone() { return this.hasAttribute('phone'); }
    get phoneMax() { return parseInt(this.getAttribute('phone-max'), 10) || 767; }
    set phoneMax(v) { this.setAttribute('phone-max', String(v)); }

    connectedCallback() {
      addPageSheet();
      if (!this.shadowRoot.firstChild) this._render();
      this._watchPhone();
      this._narrow = window.innerWidth < NARROW;
      this._applyStoredFold();
      document.addEventListener('keydown', this._onKeydown);
      window.addEventListener('resize', this._onResize);
      this._sync();
      // Transitions only for what happens after the first paint
      requestAnimationFrame(() => requestAnimationFrame(() => boolAttr(this, 'ready', true)));
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this._onKeydown);
      window.removeEventListener('resize', this._onResize);
      cancelAnimationFrame(this._resizeFrame);
      this._phoneQuery?.removeEventListener('change', this._onPhoneChange);
      clearTimeout(this._foldingTimer);
      this._setPageLocked(false);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this.shadowRoot.firstChild) return;
      if (name === 'account') this._renderAccount();
      else if (name === 'phone-max') { this._watchPhone(); this._sync(); }
      else if (name === 'collapsed' || name === 'open') this._sync(name === 'open' ? oldValue !== null : undefined);
      else this._renderLabels();
    }

    /** Folds or unfolds the wide column, as the tab does. */
    toggleFold() {
      if (this.phone) return;
      const collapsing = !this.collapsed;
      if (collapsing) {
        boolAttr(this, 'folding', true);
        clearTimeout(this._foldingTimer);
        this._foldingTimer = setTimeout(() => boolAttr(this, 'folding', false), 1200);
      }
      this.collapsed = collapsing;
      this._storeFold();
    }

    /** Opens or closes the phone's drawer. */
    toggleDrawer(force) {
      if (!this.phone) return;
      this.open = typeof force === 'boolean' ? force : !this.open;
    }

    _render() {
      this.shadowRoot.innerHTML = `
        <style>${COLUMN_CSS}</style>
        <div class="column" part="column">
          <div class="head">
            <span class="lockup" role="img" aria-label="DardaniaLabs">
              <svg viewBox="0 0 560 120" focusable="false" aria-hidden="true">
                <g transform="translate(6,10)">${D}</g>
                <text class="word" x="118" y="79" font-size="58" font-weight="800" letter-spacing="-1.5">Dardania<tspan class="word-l">L</tspan>abs</text>
              </svg>
            </span>
            <button class="back" type="button">${ARROW}</button>
          </div>
          <div class="account" hidden><span class="initial" aria-hidden="true"></span><span class="mail"></span><span class="note"><slot name="account"></slot></span></div>
          <div class="drawer"><slot name="drawer"></slot></div>
          <div class="body" part="body"><slot></slot></div>
          <div class="foot" part="foot"><slot name="foot"></slot></div>
        </div>
        <button class="toggle" type="button"></button>
        <div class="scrim"></div>
      `;
      const root = this.shadowRoot;
      root.querySelector('.toggle').addEventListener('click', () => this.toggleFold());
      root.querySelector('.back').addEventListener('click', () => this.toggleDrawer(false));
      root.querySelector('.scrim').addEventListener('click', () => this.toggleDrawer(false));
      // The D that opened the drawer closes it: the lockup's D stands where the button's was
      root.querySelector('.lockup').addEventListener('click', () => this.phone && this.toggleDrawer(false));
      // A link chosen puts the drawer away, whatever its href says (the webmail's
      // contact groups are "#" and a handler); one marked to keep it (a menu
      // opening over it, a switch) leaves it open. Heard on the way down, so a
      // list widget that stops its clicks (the webmail's folders) still closes it.
      this.addEventListener('click', (event) => {
        const link = event.target.closest?.('a[href]');
        if (this.phone && this.open && link && !link.closest('[data-dardanialabs-sidebar-keep]')) this.toggleDrawer(false);
      }, true);
      const foot = root.querySelector('slot[name="foot"]');
      const showFoot = () => root.querySelector('.foot').classList.toggle('filled', foot.assignedElements().length > 0);
      foot.addEventListener('slotchange', showFoot);
      showFoot();
      const note = root.querySelector('slot[name="account"]');
      const showNote = () => root.querySelector('.account').classList.toggle('noted', note.assignedElements().length > 0);
      note.addEventListener('slotchange', showNote);
      showNote();
      this._renderAccount();
      this._renderLabels();
      this._measureWord();
      document.fonts?.ready?.then(() => this._measureWord());
    }

    _renderAccount() {
      const account = this.shadowRoot.querySelector('.account');
      const mail = this.account;
      account.hidden = !mail;
      account.title = mail;
      account.querySelector('.initial').textContent = mail ? mail.charAt(0).toUpperCase() : '';
      account.querySelector('.mail').textContent = mail;
    }

    _renderLabels() {
      const toggle = this.shadowRoot.querySelector('.toggle');
      const words = this.collapsed
        ? this.getAttribute('unfold-label') || 'Open the menu'
        : this.getAttribute('fold-label') || 'Fold the menu';
      toggle.setAttribute('aria-label', words);
      toggle.title = words;
      toggle.setAttribute('aria-expanded', String(!this.collapsed));
      this.shadowRoot.querySelector('.back').setAttribute('aria-label', this.getAttribute('close-label') || 'Close the menu');
    }

    // Where the name ends, in the lockup's units, so the phone's arrow stands
    // just after its last letter whatever font drew it
    _measureWord() {
      const word = this.shadowRoot.querySelector('.word');
      let length = 0;
      try { length = word.getComputedTextLength(); } catch { /* not laid out yet */ }
      if (length > 0) this.shadowRoot.querySelector('.head').style.setProperty('--word-end', String(118 + length));
    }

    _watchPhone() {
      this._phoneQuery?.removeEventListener('change', this._onPhoneChange);
      // A page without matchMedia (a test DOM, an old embed) is never a phone
      this._phoneQuery = window.matchMedia
        ? window.matchMedia(`(max-width: ${this.phoneMax}px)`)
        : { matches: false, addEventListener() {}, removeEventListener() {} };
      this._phoneQuery.addEventListener('change', this._onPhoneChange);
      boolAttr(this, 'phone', this._phoneQuery.matches);
    }

    // The open drawer belongs to a phone's screen and goes with it; a wide
    // screen takes the fold remembered for its width
    _onPhoneChange(event) {
      boolAttr(this, 'phone', event.matches);
      this.open = false;
      this._applyStoredFold();
      this._sync();
    }

    // Crossing 1200px swaps the wide window's fold for the narrow one's, each
    // as it was left (once a frame at most)
    _onResize() {
      cancelAnimationFrame(this._resizeFrame);
      this._resizeFrame = requestAnimationFrame(() => {
        const narrow = window.innerWidth < NARROW;
        if (narrow === this._narrow) return;
        this._narrow = narrow;
        this._applyStoredFold();
        this._measureWord();
      });
    }

    _foldKey() {
      return this.remember
        ? `dardanialabs-sidebar:${this.remember}:${window.innerWidth < NARROW ? 'narrow' : 'wide'}`
        : '';
    }

    _applyStoredFold() {
      if (this.phone) return;
      let stored = null;
      try {
        const key = this._foldKey();
        if (key) stored = localStorage.getItem(key);
      } catch { /* private mode: the default stands */ }
      if (stored === 'true' || stored === 'false') this.collapsed = stored === 'true';
      else if (this.remember) this.collapsed = window.innerWidth < NARROW;
    }

    _storeFold() {
      try {
        const key = this._foldKey();
        if (key) localStorage.setItem(key, String(this.collapsed));
      } catch { /* kept for this page only */ }
    }

    _onKeydown(event) {
      if (event.key === 'Escape' && this.phone && this.open) this.toggleDrawer(false);
    }

    // The page under the open drawer: still, and out of the keyboard's reach
    _setPageLocked(locked) {
      // Only what this element locked is unlocked: a dialog's own lock stays its own
      if (this._locked === locked) return;
      this._locked = locked;
      document.body.style.overflow = locked ? 'hidden' : '';
      document.querySelectorAll('[data-dardanialabs-sidebar-page]').forEach((el) => {
        if (locked) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
      });
    }

    _sync(wasOpen) {
      const phone = this.phone;
      const open = phone && this.open;
      document.documentElement.style.setProperty(
        '--dardanialabs-sidebar-width',
        phone ? '0px' : `${this.collapsed ? CLOSED : OPEN}px`
      );
      this._setPageLocked(open);
      this._renderLabels();
      // Focus goes with the drawer: in to its close arrow, back to the button
      if (open && wasOpen === false) {
        requestAnimationFrame(() => this.shadowRoot.querySelector('.back')?.focus({ preventScroll: true }));
      } else if (phone && !open && wasOpen === true) {
        document.querySelector('dardanialabs-sidebar-button')?.focus({ preventScroll: true });
      }
      this.dispatchEvent(new CustomEvent('dardanialabs-sidebar-change', {
        bubbles: true,
        composed: true,
        detail: { collapsed: this.collapsed, open, phone },
      }));
    }
  }

  // ---- The phone's menu button: the D, and the arrow after it ------------------
  // The D as large as the drawer's lockup draws it (its 44.8px canvas draws a
  // D of 100 units in 37.33px) and where it draws it: its middle (60 and 48
  // hundredths of its canvas) 25px in from the page's edge, on the bar's
  // middle line. The arrow on the D's canvas, 30 units clear of its ink.
  const BUTTON_CSS = `
:host {
  ${vars}
  --m: calc(44.8px * 100 / 120);
  display: inline-flex; align-self: stretch; height: var(--bar);
}
button {
  display: flex; align-items: center; height: 100%;
  padding: 0 14px 0 calc(25px - .6 * var(--m));
  background: none; border: 0; color: var(--text-hi); cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
button:focus-visible { outline: 2px solid var(--accent-hot); outline-offset: -4px; border-radius: 8px; }
svg.d { display: block; flex: none; width: var(--m); height: var(--m); overflow: visible; }
path { fill: none; stroke-width: 14; }
.mark-l { stroke: var(--accent); }
.mark-c { stroke: currentColor; }
svg.arrow { display: block; flex: none; width: calc(var(--m) * .2229); height: var(--m); margin-left: calc(var(--m) * .25); }
polygon { fill: currentColor; }
`;

  class DardaniaLabsSidebarButton extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open', delegatesFocus: true });
      this._onChange = this._onChange.bind(this);
    }

    connectedCallback() {
      if (!this.shadowRoot.firstChild) {
        this.shadowRoot.innerHTML = `
          <style>${BUTTON_CSS}</style>
          <button type="button" aria-expanded="false">
            <svg class="d" viewBox="0 0 100 100" focusable="false" aria-hidden="true">${D}</svg>${ARROW}
          </button>
        `;
        this.shadowRoot.querySelector('button').addEventListener('click', () => this._sidebar()?.toggleDrawer());
      }
      this.shadowRoot.querySelector('button').setAttribute('aria-label', this.getAttribute('label') || 'Open the menu');
      document.addEventListener('dardanialabs-sidebar-change', this._onChange);
    }

    disconnectedCallback() {
      document.removeEventListener('dardanialabs-sidebar-change', this._onChange);
    }

    // The sidebar named by for="id", or the page's one
    _sidebar() {
      const id = this.getAttribute('for');
      return id ? document.getElementById(id) : document.querySelector('dardanialabs-sidebar');
    }

    _onChange(event) {
      if (event.target === this._sidebar()) {
        this.shadowRoot.querySelector('button')?.setAttribute('aria-expanded', String(event.detail.open));
      }
    }
  }

  if (!customElements.get('dardanialabs-sidebar')) {
    customElements.define('dardanialabs-sidebar', DardaniaLabsSidebar);
  }
  if (!customElements.get('dardanialabs-sidebar-button')) {
    customElements.define('dardanialabs-sidebar-button', DardaniaLabsSidebarButton);
  }
})();
