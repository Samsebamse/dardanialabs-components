/**
 * Time Picker Web Component
 * Same design language as <dardanialabs-datepicker> — same trigger, same card
 * — but the popup is two scrollable wheels: hours 00–23 and minutes on a step.
 * Each pick commits straight into the value (and shows in the live HH:MM
 * preview above the columns), so half a time is never silently lost.
 *
 * The popup lives in the shadow root but is positioned `fixed` from the
 * trigger's rect, so it escapes table cells and overflow:hidden ancestors,
 * flips to a drop-up when the viewport bottom is close, repositions on resize
 * and closes when the page scrolls under it — while the columns' own scrolling
 * stays untouched. (One caveat is unavoidable: an ancestor with a
 * transform/filter becomes the containing block for fixed elements, so inside
 * one the popup follows that ancestor instead.)
 *
 * Usage:
 *   <dardanialabs-timepicker placeholder="Velg tid"></dardanialabs-timepicker>
 *   <dardanialabs-timepicker value="09:30" step="15" locale="en"></dardanialabs-timepicker>
 *
 *   el.value = '17:45';                          // property or attribute
 *   el.addEventListener('change', (e) => e.detail.value);
 *
 * Attributes (all mirrored as properties):
 *   value         "HH:MM", 24-hour, or empty      (reflected)
 *   step          minute step                     (default 5)
 *   locale        BCP47, or 'no' / 'en'           (default 'no')
 *   placeholder   trigger text while empty
 *   disabled      trigger is inert
 *   error         red ring on the trigger
 *   clearable     footer "Tøm" / "Clear"          (default on, use clearable="false" to drop it)
 *
 * Events:
 *   change   CustomEvent, bubbles + composed, detail: { value }
 *            — the single event, fired on every hour/minute pick and on clear.
 *
 * Theming (CSS custom properties on the host — digitaldetoxescape defaults):
 *   --dardanialabs-tp-bg              trigger background        (#faf6ee)
 *   --dardanialabs-tp-surface         popup card background     (#ffffff)
 *   --dardanialabs-tp-ink             text                      (#2b2a26)
 *   --dardanialabs-tp-muted           placeholder / column caps (#6f6a60)
 *   --dardanialabs-tp-border          trigger border            (#d9cfbf)
 *   --dardanialabs-tp-popup-border    popup border              (#e7dcc9)
 *   --dardanialabs-tp-accent          focus ring + hover ink    (#c4622d)
 *   --dardanialabs-tp-accent-soft     focus ring halo           (rgba(196,98,45,.15))
 *   --dardanialabs-tp-hover-bg        option hover background   (#faf6ee)
 *   --dardanialabs-tp-heading         preview, captions, icon   (#3d5142)
 *   --dardanialabs-tp-selected-bg     selected hour / minute    (#6b7d5a, olive)
 *   --dardanialabs-tp-selected-ink    ink on the selection      (#faf6ee)
 *   --dardanialabs-tp-disabled        dimmed text               (#d9cfbf)
 *   --dardanialabs-tp-error           error ring                (#b3402a)
 *   --dardanialabs-tp-error-soft      error halo                (rgba(179,64,42,.15))
 *   --dardanialabs-tp-scroll-thumb    column scrollbar thumb    (rgba(196,98,45,.35))
 *   --dardanialabs-tp-radius          trigger radius            (12px)
 *   --dardanialabs-tp-popup-radius    popup radius              (16px)
 *   --dardanialabs-tp-cell-radius     option radius             (9px)
 *   --dardanialabs-tp-shadow          popup shadow              (0 12px 36px rgba(40,51,40,.14))
 *   --dardanialabs-tp-font-size       trigger font size         (1rem)
 *   --dardanialabs-tp-padding         trigger padding           (0.85rem 1rem)
 *   --dardanialabs-tp-col-height      column height             (196px)
 *   --dardanialabs-tp-z               popup z-index             (9999)
 *   font-family is inherited, so each site's typeface flows straight in.
 */

class DardaniaLabsTimepicker extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'step', 'locale', 'placeholder', 'disabled', 'error', 'clearable'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;
    this.ready = false;

    // Bound once so open/close can add and remove the very same references.
    this.onDocDown = (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this) || this.contains(e.target)) return;
      this.close();
    };
    this.onDocKey = (e) => { if (e.key === 'Escape') this.close(); };
    this.onWinResize = () => this.position();
    // Scroll events from inside the shadow root don't compose, so the columns'
    // own scrolling never reaches this — anything that does is the page moving.
    this.onWinScroll = (e) => {
      const pop = this.shadowRoot.querySelector('.pop');
      if (pop && e.target && e.target.nodeType === 1 && pop.contains(e.target)) return;
      this.close();
    };
  }

  connectedCallback() {
    if (!this.ready) this.render();
    this.syncTrigger();
  }

  disconnectedCallback() {
    this.detachGlobals();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.ready) return;
    this.syncTrigger();
    if (this.isOpen) {
      if (name === 'step' || name === 'locale' || name === 'clearable') { this.renderPop(); this.position(); this.scrollToSelection(); }
      else this.syncSelection();
    }
  }

  /* ---------- properties ---------- */

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v == null ? '' : String(v)); }

  get step() {
    const n = parseInt(this.getAttribute('step'), 10);
    return Number.isFinite(n) && n > 0 && n <= 60 ? n : 5;
  }
  set step(v) { this.setAttribute('step', String(v)); }

  get placeholder() { return this.getAttribute('placeholder') || ''; }
  set placeholder(v) { this.setAttribute('placeholder', v == null ? '' : String(v)); }

  get disabled() { return this.hasAttribute('disabled') && this.getAttribute('disabled') !== 'false'; }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }

  get error() { return this.hasAttribute('error') && this.getAttribute('error') !== 'false'; }
  set error(v) { if (v) this.setAttribute('error', ''); else this.removeAttribute('error'); }

  // On by default — only an explicit clearable="false" takes the footer away.
  get clearable() { return this.getAttribute('clearable') !== 'false'; }
  set clearable(v) { this.setAttribute('clearable', v === false ? 'false' : 'true'); }

  /* ---------- time: two integers in, "HH:MM" out ---------- */

  pad(n) { return String(n).padStart(2, '0'); }

  parse(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim());
    if (!m) return null;
    const h = +m[1];
    const min = +m[2];
    if (h > 23 || min > 59) return null;
    return { h, m: min };
  }

  get parts() { return this.parse(this.value); }

  minuteList() {
    const step = this.step;
    const list = [];
    for (let m = 0; m < 60; m += step) list.push(m);
    // A preloaded value off the step grid still deserves a visible option.
    const p = this.parts;
    if (p && !list.includes(p.m)) list.push(p.m);
    return list.sort((a, b) => a - b);
  }

  /* ---------- locale ---------- */

  get localeTag() {
    const raw = (this.getAttribute('locale') || 'no').trim();
    if (!raw || raw.toLowerCase() === 'no') return 'nb-NO';
    if (raw.toLowerCase() === 'en') return 'en-GB';
    return raw;
  }

  get isNorwegian() {
    return /^(no|nb|nn)\b/i.test(this.localeTag);
  }

  text(key) {
    const no = { clear: 'Tøm', dialog: 'Velg tid', hour: 'Time', minute: 'Minutt' };
    const en = { clear: 'Clear', dialog: 'Choose time', hour: 'Hour', minute: 'Minute' };
    return (this.isNorwegian ? no : en)[key];
  }

  /* ---------- commit ---------- */

  commit(next) {
    if (next === this.value) return;
    this.value = next;
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { value: next },
    }));
  }

  pickHour(h) {
    const p = this.parts;
    this.commit(`${this.pad(h)}:${this.pad(p ? p.m : 0)}`);
  }

  pickMinute(m) {
    const p = this.parts;
    this.commit(`${this.pad(p ? p.h : 0)}:${this.pad(m)}`);
  }

  /* ---------- open / close / position ---------- */

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.isOpen || this.disabled) return;
    this.isOpen = true;
    const pop = this.shadowRoot.querySelector('.pop');
    const trigger = this.shadowRoot.querySelector('.trigger');
    trigger.setAttribute('aria-expanded', 'true');
    this.setAttribute('data-open', '');
    this.renderPop();
    pop.hidden = false;
    this.position();
    this.scrollToSelection();
    requestAnimationFrame(() => { if (this.isOpen) pop.classList.add('show'); });
    document.addEventListener('pointerdown', this.onDocDown, true);
    document.addEventListener('keydown', this.onDocKey);
    window.addEventListener('resize', this.onWinResize);
    window.addEventListener('scroll', this.onWinScroll, true);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    const pop = this.shadowRoot.querySelector('.pop');
    const trigger = this.shadowRoot.querySelector('.trigger');
    if (pop) { pop.classList.remove('show'); pop.hidden = true; }
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    this.removeAttribute('data-open');
    this.detachGlobals();
  }

  detachGlobals() {
    document.removeEventListener('pointerdown', this.onDocDown, true);
    document.removeEventListener('keydown', this.onDocKey);
    window.removeEventListener('resize', this.onWinResize);
    window.removeEventListener('scroll', this.onWinScroll, true);
  }

  // Coordinates come from the trigger's rect at open time; the popup is fixed,
  // so no ancestor's overflow can clip it and no table cell can trap it.
  position() {
    if (!this.isOpen) return;
    const pop = this.shadowRoot.querySelector('.pop');
    const trigger = this.shadowRoot.querySelector('.trigger');
    if (!pop || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const margin = 8;

    pop.style.minWidth = `${Math.max(rect.width, 208)}px`;
    pop.style.top = 'auto';
    pop.style.bottom = 'auto';

    const height = pop.offsetHeight || 280;
    const width = pop.offsetWidth || 208;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const up = spaceBelow < height + gap && spaceAbove > spaceBelow;

    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    pop.style.left = `${Math.round(left)}px`;
    if (up) pop.style.bottom = `${Math.round(window.innerHeight - rect.top + gap)}px`;
    else pop.style.top = `${Math.round(rect.bottom + gap)}px`;
    pop.classList.toggle('up', up);
  }

  // The chosen hour and minute open centered in their column, not scrolled off.
  scrollToSelection() {
    this.shadowRoot.querySelectorAll('.col').forEach((col) => {
      const sel = col.querySelector('.opt.sel');
      if (!sel) { col.scrollTop = 0; return; }
      col.scrollTop = Math.max(0, sel.offsetTop - (col.clientHeight - sel.offsetHeight) / 2);
    });
  }

  /* ---------- rendering ---------- */

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          font-family: inherit;

          --tp-bg: var(--dardanialabs-tp-bg, #faf6ee);
          --tp-surface: var(--dardanialabs-tp-surface, #ffffff);
          --tp-ink: var(--dardanialabs-tp-ink, #2b2a26);
          --tp-muted: var(--dardanialabs-tp-muted, #6f6a60);
          --tp-border: var(--dardanialabs-tp-border, #d9cfbf);
          --tp-popup-border: var(--dardanialabs-tp-popup-border, #e7dcc9);
          --tp-accent: var(--dardanialabs-tp-accent, #c4622d);
          --tp-accent-soft: var(--dardanialabs-tp-accent-soft, rgba(196, 98, 45, 0.15));
          --tp-hover-bg: var(--dardanialabs-tp-hover-bg, #faf6ee);
          --tp-heading: var(--dardanialabs-tp-heading, #3d5142);
          --tp-selected-bg: var(--dardanialabs-tp-selected-bg, #6b7d5a);
          --tp-selected-ink: var(--dardanialabs-tp-selected-ink, #faf6ee);
          --tp-disabled: var(--dardanialabs-tp-disabled, #d9cfbf);
          --tp-error: var(--dardanialabs-tp-error, #b3402a);
          --tp-error-soft: var(--dardanialabs-tp-error-soft, rgba(179, 64, 42, 0.15));
          --tp-scroll-thumb: var(--dardanialabs-tp-scroll-thumb, rgba(196, 98, 45, 0.35));
          --tp-radius: var(--dardanialabs-tp-radius, 12px);
          --tp-popup-radius: var(--dardanialabs-tp-popup-radius, 16px);
          --tp-cell-radius: var(--dardanialabs-tp-cell-radius, 9px);
          --tp-shadow: var(--dardanialabs-tp-shadow, 0 12px 36px rgba(40, 51, 40, 0.14));
          --tp-font-size: var(--dardanialabs-tp-font-size, 1rem);
          --tp-padding: var(--dardanialabs-tp-padding, 0.85rem 1rem);
          --tp-col-height: var(--dardanialabs-tp-col-height, 196px);
          --tp-z: var(--dardanialabs-tp-z, 9999);
        }
        [hidden] { display: none !important; }
        button { font-family: inherit; }

        .trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          width: 100%;
          font-size: var(--tp-font-size);
          text-align: left;
          padding: var(--tp-padding);
          border: 1px solid var(--tp-border);
          border-radius: var(--tp-radius);
          background: var(--tp-bg);
          color: var(--tp-ink);
          cursor: pointer;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .trigger:focus-visible,
        :host([data-open]) .trigger {
          outline: none;
          border-color: var(--tp-accent);
          box-shadow: 0 0 0 3px var(--tp-accent-soft);
        }
        :host([error]:not([error="false"])) .trigger {
          border-color: var(--tp-error);
          box-shadow: 0 0 0 3px var(--tp-error-soft);
        }
        .trigger:disabled { opacity: 0.6; cursor: not-allowed; }
        .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .label.ph { color: var(--tp-muted); }
        .ico { flex: none; color: var(--tp-heading); opacity: 0.7; }

        .pop {
          position: fixed;
          z-index: var(--tp-z);
          min-width: 208px;
          padding: 0.7rem;
          background: var(--tp-surface);
          border: 1px solid var(--tp-popup-border);
          border-radius: var(--tp-popup-radius);
          box-shadow: var(--tp-shadow);
          color: var(--tp-ink);
          opacity: 0;
          transform: translateY(-6px);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .pop.up { transform: translateY(6px); }
        .pop.show { opacity: 1; transform: none; }

        .preview {
          text-align: center;
          font-weight: 600;
          font-size: 1.05rem;
          color: var(--tp-heading);
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.04em;
          padding: 0.1rem 0 0.5rem;
        }
        .preview.empty { color: var(--tp-muted); }

        .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .cap {
          text-align: center;
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--tp-muted);
          padding-bottom: 0.3rem;
        }
        .col {
          position: relative;
          height: var(--tp-col-height);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-right: 2px;
          scrollbar-width: thin;
          scrollbar-color: var(--tp-scroll-thumb) transparent;
        }
        .col::-webkit-scrollbar { width: 6px; }
        .col::-webkit-scrollbar-track { background: transparent; }
        .col::-webkit-scrollbar-thumb {
          background: var(--tp-scroll-thumb);
          border-radius: 3px;
        }
        .col::-webkit-scrollbar-thumb:hover { background: var(--tp-accent); }

        .opt {
          flex: none;
          border: none;
          background: transparent;
          color: var(--tp-ink);
          font-size: 0.88rem;
          font-variant-numeric: tabular-nums;
          padding: 0.42rem 0;
          border-radius: var(--tp-cell-radius);
          cursor: pointer;
        }
        .opt:hover:not(.sel) { background: var(--tp-hover-bg); color: var(--tp-accent); }
        .opt.sel { background: var(--tp-selected-bg); color: var(--tp-selected-ink); font-weight: 600; }

        .foot { display: flex; justify-content: flex-end; margin-top: 0.45rem; }
        .foot button {
          border: none;
          background: transparent;
          color: var(--tp-accent);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          padding: 0.3rem 0.5rem;
          border-radius: 7px;
        }
        .foot button:hover { background: var(--tp-hover-bg); }

        @media (prefers-reduced-motion: reduce) {
          .pop { transition: none; }
        }
      </style>
      <button type="button" class="trigger" aria-haspopup="dialog" aria-expanded="false">
        <span class="label"></span>
        <svg class="ico" width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <circle cx="7.5" cy="7.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/>
          <path d="M7.5 4v3.8l2.6 1.6" fill="none" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="pop" role="dialog" hidden></div>
    `;

    const trigger = this.shadowRoot.querySelector('.trigger');
    trigger.addEventListener('click', (e) => { e.preventDefault(); this.toggle(); });
    // Enter/Space already reach this as a click; ArrowDown is the extra affordance.
    trigger.addEventListener('keydown', (e) => {
      if (!this.isOpen && e.key === 'ArrowDown') { e.preventDefault(); this.open(); }
    });

    // One delegated listener survives every popup re-render — and picking
    // updates classes in place, so neither column loses its scroll position.
    this.shadowRoot.querySelector('.pop').addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!btn || btn.disabled) return;
      e.preventDefault();
      const act = btn.dataset.act;
      if (act === 'hour') this.pickHour(parseInt(btn.dataset.n, 10));
      else if (act === 'minute') this.pickMinute(parseInt(btn.dataset.n, 10));
      else if (act === 'clear') { this.commit(''); this.close(); }
    });

    this.ready = true;
  }

  syncTrigger() {
    const trigger = this.shadowRoot.querySelector('.trigger');
    const label = this.shadowRoot.querySelector('.label');
    if (!trigger || !label) return;
    trigger.disabled = this.disabled;
    if (this.disabled) this.close();
    const p = this.parts;
    const text = p ? `${this.pad(p.h)}:${this.pad(p.m)}` : '';
    label.classList.toggle('ph', !text);
    // textContent, never innerHTML: attribute text must not become markup.
    label.textContent = text || this.placeholder;
    trigger.setAttribute('aria-label', text || this.placeholder || this.text('dialog'));
  }

  renderPop() {
    const pop = this.shadowRoot.querySelector('.pop');
    if (!pop) return;
    pop.setAttribute('aria-label', this.text('dialog'));

    const hours = Array.from({ length: 24 }, (_, h) =>
      `<button type="button" class="opt" data-act="hour" data-n="${h}" data-kind="h">${this.pad(h)}</button>`).join('');
    const minutes = this.minuteList().map((m) =>
      `<button type="button" class="opt" data-act="minute" data-n="${m}" data-kind="m">${this.pad(m)}</button>`).join('');

    pop.innerHTML = `
      <div class="preview" aria-live="polite"></div>
      <div class="cols">
        <div>
          <div class="cap">${this.text('hour')}</div>
          <div class="col" role="group" aria-label="${this.text('hour')}">${hours}</div>
        </div>
        <div>
          <div class="cap">${this.text('minute')}</div>
          <div class="col" role="group" aria-label="${this.text('minute')}">${minutes}</div>
        </div>
      </div>
      <div class="foot" hidden><button type="button" data-act="clear">${this.text('clear')}</button></div>
    `;
    this.syncSelection();
  }

  // Targeted update instead of a re-render: the columns keep their scroll.
  syncSelection() {
    const pop = this.shadowRoot.querySelector('.pop');
    if (!pop || !pop.querySelector('.preview')) return;
    const p = this.parts;
    const preview = pop.querySelector('.preview');
    preview.textContent = p ? `${this.pad(p.h)}:${this.pad(p.m)}` : '--:--';
    preview.classList.toggle('empty', !p);
    pop.querySelectorAll('.opt').forEach((opt) => {
      const n = parseInt(opt.dataset.n, 10);
      const sel = Boolean(p) && (opt.dataset.kind === 'h' ? n === p.h : n === p.m);
      opt.classList.toggle('sel', sel);
      opt.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
    pop.querySelector('.foot').hidden = !(this.clearable && this.value);
  }
}

if (!customElements.get('dardanialabs-timepicker')) {
  customElements.define('dardanialabs-timepicker', DardaniaLabsTimepicker);
}
