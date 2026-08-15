/**
 * Date Picker Web Component
 * The native input's calendar popup is OS-drawn and unstylable, so this owns
 * the whole thing — Monday-first weeks, ‹ › steps months, « » steps years, and
 * the month label opens a 12-year grid (the fast lane for dates that live
 * decades away). The value is an ISO yyyy-mm-dd string built by hand from
 * year/month/day integers: toISOString() would shift the day across timezones.
 *
 * The popup lives in the shadow root but is positioned `fixed` from the
 * trigger's rect, so it escapes table cells and overflow:hidden ancestors,
 * flips to a drop-up when the viewport bottom is close, repositions on resize
 * and closes when the page scrolls under it. (One caveat is unavoidable: an
 * ancestor with a transform/filter becomes the containing block for fixed
 * elements, so inside one the popup follows that ancestor instead.)
 *
 * Usage:
 *   <dardanialabs-datepicker placeholder="Velg dato"></dardanialabs-datepicker>
 *   <dardanialabs-datepicker value="2026-08-16" min="2026-01-01" max="2026-12-31"></dardanialabs-datepicker>
 *   <dardanialabs-datepicker locale="en" today-button quick-add="4y"></dardanialabs-datepicker>
 *
 *   el.value = '2026-08-16';                     // property or attribute
 *   el.addEventListener('change', (e) => e.detail.value);
 *
 * Attributes (all mirrored as properties):
 *   value          ISO yyyy-mm-dd, or empty         (reflected)
 *   min / max      ISO bounds — gate days, month/year navigation and year cells
 *   locale         BCP47, or 'no' / 'en'            (default 'no' → nb-NO)
 *   placeholder    trigger text while empty
 *   disabled       trigger is inert
 *   error          red ring on the trigger
 *   clearable      footer "Tøm" / "Clear"           (default on, use clearable="false" to drop it)
 *   today-button   footer "I dag" / "Today"         (opt-in)
 *   quick-add      footer shortcut, e.g. "4y" → "+4 år" / "+4 years"
 *                  (also 4m months, 4w weeks, 4d days; adds to the current
 *                   value or today, then clamps into min/max)
 *
 * Events:
 *   change   CustomEvent, bubbles + composed, detail: { value }
 *            — the single event, fired on pick, clear, today and quick-add.
 *
 * Theming (CSS custom properties on the host — digitaldetoxescape defaults):
 *   --dardanialabs-dp-bg              trigger background        (#faf6ee)
 *   --dardanialabs-dp-surface         popup card background     (#ffffff)
 *   --dardanialabs-dp-ink             text                      (#2b2a26)
 *   --dardanialabs-dp-muted           placeholder / weekdays    (#6f6a60)
 *   --dardanialabs-dp-border          trigger border            (#d9cfbf)
 *   --dardanialabs-dp-popup-border    popup border              (#e7dcc9)
 *   --dardanialabs-dp-accent          focus ring + hover ink    (#c4622d)
 *   --dardanialabs-dp-accent-soft     focus ring halo           (rgba(196,98,45,.15))
 *   --dardanialabs-dp-hover-bg        cell hover background     (#faf6ee)
 *   --dardanialabs-dp-heading         month label, nav, icon    (#3d5142)
 *   --dardanialabs-dp-selected-bg     selected day / year       (#3d5142)
 *   --dardanialabs-dp-selected-ink    ink on the selection      (#faf6ee)
 *   --dardanialabs-dp-today-ring      today's outline           (#9aa888)
 *   --dardanialabs-dp-disabled        out-of-range days         (#d9cfbf)
 *   --dardanialabs-dp-error           error ring                (#b3402a)
 *   --dardanialabs-dp-error-soft      error halo                (rgba(179,64,42,.15))
 *   --dardanialabs-dp-radius          trigger radius            (12px)
 *   --dardanialabs-dp-popup-radius    popup radius              (16px)
 *   --dardanialabs-dp-cell-radius     day / year cell radius    (9px)
 *   --dardanialabs-dp-shadow          popup shadow              (0 12px 36px rgba(40,51,40,.14))
 *   --dardanialabs-dp-font-size       trigger font size         (1rem)
 *   --dardanialabs-dp-z               popup z-index             (9999)
 *   font-family is inherited, so each site's typeface flows straight in.
 */

class DardaniaLabsDatepicker extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'min', 'max', 'locale', 'placeholder', 'disabled', 'error', 'clearable', 'today-button', 'quick-add'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;
    this.mode = 'days';        // 'days' | 'years'
    this.view = { y: 0, m: 0 };
    this.yearBase = 0;
    this.ready = false;

    // Bound once so open/close can add and remove the very same references.
    this.onDocDown = (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this) || this.contains(e.target)) return;
      this.close();
    };
    this.onDocKey = (e) => { if (e.key === 'Escape') this.close(); };
    this.onWinResize = () => this.position();
    // Scroll events from inside the shadow root don't compose, so anything
    // reaching this listener is by definition the page moving under the popup.
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
      if (name === 'value') this.view = this.startView();
      this.renderPop();
      this.position();
    }
  }

  /* ---------- properties ---------- */

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v == null ? '' : String(v)); }

  get min() { return this.getAttribute('min') || ''; }
  set min(v) { this.setAttribute('min', v == null ? '' : String(v)); }

  get max() { return this.getAttribute('max') || ''; }
  set max(v) { this.setAttribute('max', v == null ? '' : String(v)); }

  get placeholder() { return this.getAttribute('placeholder') || ''; }
  set placeholder(v) { this.setAttribute('placeholder', v == null ? '' : String(v)); }

  get disabled() { return this.hasAttribute('disabled') && this.getAttribute('disabled') !== 'false'; }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }

  get error() { return this.hasAttribute('error') && this.getAttribute('error') !== 'false'; }
  set error(v) { if (v) this.setAttribute('error', ''); else this.removeAttribute('error'); }

  // On by default — only an explicit clearable="false" takes the footer away.
  get clearable() { return this.getAttribute('clearable') !== 'false'; }
  set clearable(v) { this.setAttribute('clearable', v === false ? 'false' : 'true'); }

  get todayButton() { return this.hasAttribute('today-button') && this.getAttribute('today-button') !== 'false'; }
  set todayButton(v) { if (v) this.setAttribute('today-button', ''); else this.removeAttribute('today-button'); }

  get quickAdd() { return this.getAttribute('quick-add') || ''; }
  set quickAdd(v) { this.setAttribute('quick-add', v == null ? '' : String(v)); }

  /* ---------- dates: plain integers in, plain strings out ---------- */

  pad(n) { return String(n).padStart(2, '0'); }
  iso(y, m, d) { return `${y}-${this.pad(m + 1)}-${this.pad(d)}`; }

  parse(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  }

  todayParts() {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  }

  todayIso() {
    const t = this.todayParts();
    return this.iso(t.y, t.m, t.d);
  }

  daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  inRange(s) {
    return (!this.min || s >= this.min) && (!this.max || s <= this.max);
  }

  // Push a date into the allowed window rather than refusing it — a shortcut
  // that lands past `max` still means "as far as the rule allows".
  clampIso(s) {
    if (this.min && s < this.min) return this.min;
    if (this.max && s > this.max) return this.max;
    return s;
  }

  startView() {
    const p = this.parse(this.value) || this.parse(this.max) || this.todayParts();
    return { y: p.y, m: p.m };
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
    const no = { clear: 'Tøm', today: 'I dag', pickYear: 'Velg år', dialog: 'Velg dato', prevYear: 'Forrige år', prevMonth: 'Forrige måned', nextMonth: 'Neste måned', nextYear: 'Neste år', earlier: 'Tidligere år', later: 'Senere år' };
    const en = { clear: 'Clear', today: 'Today', pickYear: 'Pick a year', dialog: 'Choose date', prevYear: 'Previous year', prevMonth: 'Previous month', nextMonth: 'Next month', nextYear: 'Next year', earlier: 'Earlier years', later: 'Later years' };
    return (this.isNorwegian ? no : en)[key];
  }

  fmt(options, date) {
    try {
      return new Intl.DateTimeFormat(this.localeTag, options).format(date);
    } catch {
      return new Intl.DateTimeFormat('en-GB', options).format(date);
    }
  }

  // Monday-first initials, derived from a week that starts on a known Monday.
  weekdayInitials() {
    return Array.from({ length: 7 }, (_, i) =>
      this.fmt({ weekday: 'short' }, new Date(2024, 0, 1 + i)).slice(0, 2));
  }

  /* ---------- quick-add ---------- */

  // "4y" → { n: 4, unit: 'y' }. Bare numbers mean years.
  parseQuickAdd() {
    const m = /^\s*\+?(\d+)\s*([ymwd])?\s*$/i.exec(this.quickAdd);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (!n) return null;
    return { n, unit: (m[2] || 'y').toLowerCase() };
  }

  quickAddLabel(q) {
    const words = this.isNorwegian
      ? { y: q.n === 1 ? 'år' : 'år', m: q.n === 1 ? 'måned' : 'måneder', w: q.n === 1 ? 'uke' : 'uker', d: q.n === 1 ? 'dag' : 'dager' }
      : { y: q.n === 1 ? 'year' : 'years', m: q.n === 1 ? 'month' : 'months', w: q.n === 1 ? 'week' : 'weeks', d: q.n === 1 ? 'day' : 'days' };
    return `+${q.n} ${words[q.unit]}`;
  }

  applyQuickAdd() {
    const q = this.parseQuickAdd();
    if (!q) return;
    const base = this.parse(this.value) || this.todayParts();
    let { y, m, d } = base;
    if (q.unit === 'y') y += q.n;
    else if (q.unit === 'm') {
      const t = new Date(y, m + q.n, 1);
      y = t.getFullYear();
      m = t.getMonth();
    } else {
      const t = new Date(y, m, d + q.n * (q.unit === 'w' ? 7 : 1));
      y = t.getFullYear();
      m = t.getMonth();
      d = t.getDate();
    }
    // 31 Jan + 1 month, or 29 Feb + 1 year: keep the day inside the month.
    d = Math.min(d, this.daysInMonth(y, m));
    this.commit(this.clampIso(this.iso(y, m, d)));
  }

  /* ---------- commit ---------- */

  commit(next) {
    if (next !== this.value) {
      this.value = next;
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { value: next },
      }));
    }
    this.close();
  }

  /* ---------- open / close / position ---------- */

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.isOpen || this.disabled) return;
    this.isOpen = true;
    this.view = this.startView();
    this.mode = 'days';
    const pop = this.shadowRoot.querySelector('.pop');
    const trigger = this.shadowRoot.querySelector('.trigger');
    trigger.setAttribute('aria-expanded', 'true');
    this.setAttribute('data-open', '');
    this.renderPop();
    pop.hidden = false;
    this.position();
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

    pop.style.minWidth = `${Math.max(rect.width, 288)}px`;
    pop.style.top = 'auto';
    pop.style.bottom = 'auto';

    const height = pop.offsetHeight || 320;
    const width = pop.offsetWidth || 288;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const up = spaceBelow < height + gap && spaceAbove > spaceBelow;

    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    pop.style.left = `${Math.round(left)}px`;
    if (up) pop.style.bottom = `${Math.round(window.innerHeight - rect.top + gap)}px`;
    else pop.style.top = `${Math.round(rect.bottom + gap)}px`;
    pop.classList.toggle('up', up);
  }

  /* ---------- navigation ---------- */

  shift(months) {
    const t = new Date(this.view.y, this.view.m + months, 1);
    this.view = { y: t.getFullYear(), m: t.getMonth() };
    this.renderPop();
    this.position();
  }

  // A whole step is pointless when every day it would reveal is out of range.
  canShift(months) {
    const t = new Date(this.view.y, this.view.m + months, 1);
    const y = t.getFullYear();
    const m = t.getMonth();
    if (this.max && this.iso(y, m, 1) > this.max) return false;
    if (this.min && this.iso(y, m, this.daysInMonth(y, m)) < this.min) return false;
    return true;
  }

  yearOk(y) {
    if (this.max && `${y}-01-01` > this.max) return false;
    if (this.min && `${y}-12-31` < this.min) return false;
    return true;
  }

  canPageYears(dir) {
    return this.yearOk(this.yearBase + (dir > 0 ? 12 : -1));
  }

  pickYear(y) {
    if (!this.yearOk(y)) return;
    let m = this.view.m;
    const pMax = this.parse(this.max);
    const pMin = this.parse(this.min);
    if (pMax && y === pMax.y && m > pMax.m) m = pMax.m;
    if (pMin && y === pMin.y && m < pMin.m) m = pMin.m;
    this.view = { y, m };
    this.mode = 'days';
    this.renderPop();
    this.position();
  }

  /* ---------- rendering ---------- */

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          font-family: inherit;

          --dp-bg: var(--dardanialabs-dp-bg, #faf6ee);
          --dp-surface: var(--dardanialabs-dp-surface, #ffffff);
          --dp-ink: var(--dardanialabs-dp-ink, #2b2a26);
          --dp-muted: var(--dardanialabs-dp-muted, #6f6a60);
          --dp-border: var(--dardanialabs-dp-border, #d9cfbf);
          --dp-popup-border: var(--dardanialabs-dp-popup-border, #e7dcc9);
          --dp-accent: var(--dardanialabs-dp-accent, #c4622d);
          --dp-accent-soft: var(--dardanialabs-dp-accent-soft, rgba(196, 98, 45, 0.15));
          --dp-hover-bg: var(--dardanialabs-dp-hover-bg, #faf6ee);
          --dp-heading: var(--dardanialabs-dp-heading, #3d5142);
          --dp-selected-bg: var(--dardanialabs-dp-selected-bg, #3d5142);
          --dp-selected-ink: var(--dardanialabs-dp-selected-ink, #faf6ee);
          --dp-today-ring: var(--dardanialabs-dp-today-ring, #9aa888);
          --dp-disabled: var(--dardanialabs-dp-disabled, #d9cfbf);
          --dp-error: var(--dardanialabs-dp-error, #b3402a);
          --dp-error-soft: var(--dardanialabs-dp-error-soft, rgba(179, 64, 42, 0.15));
          --dp-radius: var(--dardanialabs-dp-radius, 12px);
          --dp-popup-radius: var(--dardanialabs-dp-popup-radius, 16px);
          --dp-cell-radius: var(--dardanialabs-dp-cell-radius, 9px);
          --dp-shadow: var(--dardanialabs-dp-shadow, 0 12px 36px rgba(40, 51, 40, 0.14));
          --dp-font-size: var(--dardanialabs-dp-font-size, 1rem);
          --dp-z: var(--dardanialabs-dp-z, 9999);
        }
        [hidden] { display: none !important; }
        button { font-family: inherit; }

        .trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          width: 100%;
          font-size: var(--dp-font-size);
          text-align: left;
          padding: 0.85rem 1rem;
          border: 1px solid var(--dp-border);
          border-radius: var(--dp-radius);
          background: var(--dp-bg);
          color: var(--dp-ink);
          cursor: pointer;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .trigger:focus-visible,
        :host([data-open]) .trigger {
          outline: none;
          border-color: var(--dp-accent);
          box-shadow: 0 0 0 3px var(--dp-accent-soft);
        }
        :host([error]:not([error="false"])) .trigger {
          border-color: var(--dp-error);
          box-shadow: 0 0 0 3px var(--dp-error-soft);
        }
        .trigger:disabled { opacity: 0.6; cursor: not-allowed; }
        .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .label.ph { color: var(--dp-muted); }
        .ico { flex: none; color: var(--dp-heading); opacity: 0.7; }

        .pop {
          position: fixed;
          z-index: var(--dp-z);
          min-width: 288px;
          padding: 0.8rem;
          background: var(--dp-surface);
          border: 1px solid var(--dp-popup-border);
          border-radius: var(--dp-popup-radius);
          box-shadow: var(--dp-shadow);
          color: var(--dp-ink);
          opacity: 0;
          transform: translateY(-6px);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .pop.up { transform: translateY(6px); }
        .pop.show { opacity: 1; transform: none; }

        .head { display: flex; align-items: center; gap: 0.2rem; margin-bottom: 0.55rem; }
        .month {
          flex: 1;
          text-align: center;
          font-weight: 600;
          color: var(--dp-heading);
          text-transform: capitalize;
          font-size: 0.95rem;
          border: none;
          background: transparent;
          padding: 0.3rem 0.4rem;
          border-radius: 8px;
          cursor: pointer;
        }
        .month:hover { background: var(--dp-hover-bg); color: var(--dp-accent); }
        .range { flex: 1; text-align: center; font-weight: 600; color: var(--dp-heading); font-size: 0.95rem; }
        .nav {
          border: none;
          background: transparent;
          color: var(--dp-heading);
          font-size: 1rem;
          line-height: 1;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          cursor: pointer;
        }
        .nav:hover:not(:disabled) { background: var(--dp-hover-bg); color: var(--dp-accent); }
        .nav:disabled { opacity: 0.25; cursor: default; }

        .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .wk span {
          text-align: center;
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--dp-muted);
          padding: 0.25rem 0;
        }
        .day {
          border: none;
          background: transparent;
          font-size: 0.88rem;
          color: var(--dp-ink);
          width: 100%;
          aspect-ratio: 1;
          padding: 0;
          border-radius: var(--dp-cell-radius);
          cursor: pointer;
        }
        .day:hover:not(:disabled) { background: var(--dp-hover-bg); color: var(--dp-accent); }
        .day.today { box-shadow: inset 0 0 0 1px var(--dp-today-ring); }
        .day.sel { background: var(--dp-selected-bg); color: var(--dp-selected-ink); }
        .day.off { color: var(--dp-disabled); cursor: default; }
        .day.blank { cursor: default; }

        .years { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
        .year {
          border: none;
          background: transparent;
          font-size: 0.9rem;
          color: var(--dp-ink);
          padding: 0.55rem 0;
          border-radius: var(--dp-cell-radius);
          cursor: pointer;
        }
        .year:hover:not(:disabled) { background: var(--dp-hover-bg); color: var(--dp-accent); }
        .year.sel { background: var(--dp-selected-bg); color: var(--dp-selected-ink); }
        .year.off { color: var(--dp-disabled); cursor: default; }

        .foot { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; margin-top: 0.5rem; }
        .foot .right { display: flex; align-items: center; gap: 0.2rem; margin-left: auto; }
        .foot button {
          border: none;
          background: transparent;
          color: var(--dp-accent);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          padding: 0.3rem 0.5rem;
          border-radius: 7px;
        }
        .foot button:hover { background: var(--dp-hover-bg); }

        @media (prefers-reduced-motion: reduce) {
          .pop { transition: none; }
        }
      </style>
      <button type="button" class="trigger" aria-haspopup="dialog" aria-expanded="false">
        <span class="label"></span>
        <svg class="ico" width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <rect x="1.5" y="2.5" width="12" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
          <path d="M1.5 6h12" stroke="currentColor" stroke-width="1.6"/>
          <path d="M4.5 1v3M10.5 1v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
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

    // One delegated listener survives every popup re-render.
    this.shadowRoot.querySelector('.pop').addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!btn || btn.disabled) return;
      e.preventDefault();
      const act = btn.dataset.act;
      if (act === 'shift') this.shift(parseInt(btn.dataset.n, 10));
      else if (act === 'years') { this.yearBase = this.view.y - ((this.view.y % 12) + 12) % 12; this.mode = 'years'; this.renderPop(); this.position(); }
      else if (act === 'page') { this.yearBase += parseInt(btn.dataset.n, 10); this.renderPop(); this.position(); }
      else if (act === 'year') this.pickYear(parseInt(btn.dataset.y, 10));
      else if (act === 'pick') this.commit(btn.dataset.iso);
      else if (act === 'clear') this.commit('');
      else if (act === 'today') this.commit(this.clampIso(this.todayIso()));
      else if (act === 'quick') this.applyQuickAdd();
    });

    this.ready = true;
  }

  syncTrigger() {
    const trigger = this.shadowRoot.querySelector('.trigger');
    const label = this.shadowRoot.querySelector('.label');
    if (!trigger || !label) return;
    trigger.disabled = this.disabled;
    if (this.disabled) this.close();
    const p = this.parse(this.value);
    const text = p ? this.fmt({ day: 'numeric', month: 'short', year: 'numeric' }, new Date(p.y, p.m, p.d)) : '';
    label.classList.toggle('ph', !text);
    // textContent, never innerHTML: attribute text must not become markup.
    label.textContent = text || this.placeholder;
    trigger.setAttribute('aria-label', text || this.placeholder || this.text('dialog'));
  }

  renderPop() {
    const pop = this.shadowRoot.querySelector('.pop');
    if (!pop) return;
    pop.setAttribute('aria-label', this.text('dialog'));
    pop.innerHTML = this.mode === 'years' ? this.yearsMarkup() : this.daysMarkup();
  }

  daysMarkup() {
    const { y, m } = this.view;
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;   // Monday-first offset
    const count = this.daysInMonth(y, m);
    const today = this.todayIso();
    const monthLabel = this.fmt({ month: 'long', year: 'numeric' }, new Date(y, m, 1));

    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<button type="button" class="day blank" disabled tabindex="-1"></button>';
    for (let d = 1; d <= count; d++) {
      const s = this.iso(y, m, d);
      const ok = this.inRange(s);
      const classes = ['day'];
      if (!ok) classes.push('off');
      if (s === this.value) classes.push('sel');
      if (s === today) classes.push('today');
      cells += `<button type="button" class="${classes.join(' ')}" data-act="pick" data-iso="${s}"${ok ? '' : ' disabled'} aria-label="${s}"${s === this.value ? ' aria-current="date"' : ''}>${d}</button>`;
    }

    return `
      <div class="head">
        <button type="button" class="nav" data-act="shift" data-n="-12"${this.canShift(-12) ? '' : ' disabled'} aria-label="${this.text('prevYear')}">&laquo;</button>
        <button type="button" class="nav" data-act="shift" data-n="-1"${this.canShift(-1) ? '' : ' disabled'} aria-label="${this.text('prevMonth')}">&lsaquo;</button>
        <button type="button" class="month" data-act="years" title="${this.text('pickYear')}">${monthLabel}</button>
        <button type="button" class="nav" data-act="shift" data-n="1"${this.canShift(1) ? '' : ' disabled'} aria-label="${this.text('nextMonth')}">&rsaquo;</button>
        <button type="button" class="nav" data-act="shift" data-n="12"${this.canShift(12) ? '' : ' disabled'} aria-label="${this.text('nextYear')}">&raquo;</button>
      </div>
      <div class="grid wk">${this.weekdayInitials().map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="grid">${cells}</div>
      ${this.footMarkup()}
    `;
  }

  yearsMarkup() {
    const years = Array.from({ length: 12 }, (_, i) => this.yearBase + i);
    const cells = years.map((y) => {
      const ok = this.yearOk(y);
      return `<button type="button" class="year${ok ? '' : ' off'}${y === this.view.y ? ' sel' : ''}" data-act="year" data-y="${y}"${ok ? '' : ' disabled'}>${y}</button>`;
    }).join('');
    return `
      <div class="head">
        <button type="button" class="nav" data-act="page" data-n="-12"${this.canPageYears(-1) ? '' : ' disabled'} aria-label="${this.text('earlier')}">&laquo;</button>
        <span class="range">${years[0]} – ${years[11]}</span>
        <button type="button" class="nav" data-act="page" data-n="12"${this.canPageYears(1) ? '' : ' disabled'} aria-label="${this.text('later')}">&raquo;</button>
      </div>
      <div class="years">${cells}</div>
      ${this.footMarkup()}
    `;
  }

  footMarkup() {
    const q = this.parseQuickAdd();
    const clear = this.clearable && this.value
      ? `<button type="button" data-act="clear">${this.text('clear')}</button>` : '';
    const today = this.todayButton && this.inRange(this.todayIso())
      ? `<button type="button" data-act="today">${this.text('today')}</button>` : '';
    const quick = q ? `<button type="button" data-act="quick">${this.quickAddLabel(q)}</button>` : '';
    if (!clear && !today && !quick) return '';
    return `<div class="foot">${clear}<span class="right">${quick}${today}</span></div>`;
  }
}

if (!customElements.get('dardanialabs-datepicker')) {
  customElements.define('dardanialabs-datepicker', DardaniaLabsDatepicker);
}
