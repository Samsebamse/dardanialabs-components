/**
 * Time Picker Web Component
 * Same design language as <dardanialabs-datepicker> — same trigger, same card
 * — but the popup is two scrollable wheels: hours 00–23 and minutes on a step.
 * Each pick commits straight into the value (and shows in the live HH:MM
 * preview above the columns), so half a time is never silently lost.
 *
 * Two faces share that shell. face="columns" is the wheels above; face="clock"
 * swaps them for an analog dial — a two-ring 24-hour clock, 1–12 on the outer
 * ring and 13–23 plus 00 on the inner one, hours picked first and then a
 * minutes ring, hand and centre dot included. The HH:MM preview doubles as the
 * mode indicator there: the active half is lit, and tapping the hour half walks
 * back from minutes to hours. Escape still closes; the arrow keys walk the
 * active part around its ring.
 *
 * hour12 is orthogonal to both faces and changes only what is *shown*: the
 * trigger and the preview read "9:30 AM", the columns count 12, 1 … 11 beside
 * an AM/PM rail, the dial keeps a single 1–12 ring with the same rail. The
 * attribute, the property and the change event stay 24-hour "HH:MM" throughout,
 * so nothing downstream has to know which face or clock the user saw. (AM/PM
 * stays English in every locale — the 12-hour clock is an English-language
 * convention, and Norwegian has no equivalent.)
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
 *   <dardanialabs-timepicker face="clock" value="14:30"></dardanialabs-timepicker>
 *   <dardanialabs-timepicker face="clock" hour12 locale="en"></dardanialabs-timepicker>
 *
 *   el.value = '17:45';                          // property or attribute
 *   el.hour12 = true;                            // display only, value stays 24-hour
 *   el.addEventListener('change', (e) => e.detail.value);
 *
 * Attributes (all mirrored as properties):
 *   value         "HH:MM", 24-hour, or empty      (reflected)
 *   step          minute step                     (default 5)
 *   face          "columns" | "clock"             (default 'columns')
 *   hour12        12-hour display + AM/PM rail    (display only, value stays 24-hour)
 *   locale        BCP47, or 'no' / 'en'           (default 'no')
 *   placeholder   trigger text while empty
 *   disabled      trigger is inert
 *   error         red ring on the trigger
 *   clearable     footer "Tøm" / "Clear"          (default on, use clearable="false" to drop it)
 *
 * Events:
 *   change   CustomEvent, bubbles + composed, detail: { value }
 *            — the single event, fired once per commit: every hour/minute pick
 *            on either face, every AM/PM flip that moves the value, and clear.
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
 *                                     — on the dial the hand, its tip and the
 *                                       centre dot take the accent, and the
 *                                       number inside the tip this ink.
 *   --dardanialabs-tp-disabled        dimmed text               (#d9cfbf)
 *   --dardanialabs-tp-error           error ring                (#b3402a)
 *   --dardanialabs-tp-error-soft      error halo                (rgba(179,64,42,.15))
 *   --dardanialabs-tp-scroll-thumb    column scrollbar thumb    (rgba(196,98,45,.35))
 *   --dardanialabs-tp-dial-bg         clock dial background     (falls back to the hover bg)
 *   --dardanialabs-tp-radius          trigger radius            (12px)
 *   --dardanialabs-tp-popup-radius    popup radius              (16px)
 *   --dardanialabs-tp-cell-radius     option radius             (9px)
 *   --dardanialabs-tp-shadow          popup shadow              (0 12px 36px rgba(40,51,40,.14))
 *   --dardanialabs-tp-font-size       trigger font size         (1rem)
 *   --dardanialabs-tp-padding         trigger padding           (0.85rem 1rem)
 *   --dardanialabs-tp-col-height      column height             (196px)
 *   --dardanialabs-tp-dial-size       clock dial diameter       (208px)
 *   --dardanialabs-tp-z               popup z-index             (9999)
 *   font-family is inherited, so each site's typeface flows straight in.
 */

class DardaniaLabsTimepicker extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'step', 'locale', 'placeholder', 'disabled', 'error', 'clearable', 'face', 'hour12'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;
    this.ready = false;
    // Dial state: which half the ring is showing, hours first on every open.
    this.clockMode = 'h';
    // The half of the day an empty picker will land in — once a value exists
    // the value itself says which half it is, and this only tracks it.
    this.pm = false;
    this.renderedPM = false;

    // Bound once so open/close can add and remove the very same references.
    this.onDocDown = (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this) || this.contains(e.target)) return;
      this.close();
    };
    this.onDocKey = (e) => {
      if (e.key === 'Escape') { this.close(); return; }
      if (!this.isOpen || this.face !== 'clock') return;
      // On the dial the arrows are the only non-pointer way around the ring.
      const dir = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? 1
        : (e.key === 'ArrowDown' || e.key === 'ArrowLeft') ? -1 : 0;
      if (dir) { e.preventDefault(); this.nudge(dir); }
      else if (e.key === 'Enter' && this.clockMode === 'h') { e.preventDefault(); this.setClockMode('m'); }
    };
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
    if (!this.isOpen) return;
    // The dial redraws whole — it has no scroll position to protect — and so do
    // the columns when AM/PM flips, because that renumbers the hour wheel
    // underneath. Anything else is still a targeted class swap.
    const structural = name === 'step' || name === 'locale' || name === 'clearable'
      || name === 'face' || name === 'hour12';
    if (structural || this.face === 'clock' || (this.hour12 && this.isPM !== this.renderedPM)) {
      this.renderPop();
      this.position();
      this.scrollToSelection();
    } else {
      this.syncSelection();
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

  // Only an explicit face="clock" leaves the columns — every other value, and
  // no attribute at all, is the wheels.
  get face() { return this.getAttribute('face') === 'clock' ? 'clock' : 'columns'; }
  set face(v) { this.setAttribute('face', v === 'clock' ? 'clock' : 'columns'); }

  get hour12() { return this.hasAttribute('hour12') && this.getAttribute('hour12') !== 'false'; }
  set hour12(v) { if (v) this.setAttribute('hour12', ''); else this.removeAttribute('hour12'); }

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

  /* ---------- 12-hour display (the value underneath never changes) ---------- */

  // With a value the value decides the half of the day; without one, the last
  // AM/PM the user tapped does, so the next hour pick lands where they meant.
  get isPM() {
    const p = this.parts;
    return p ? p.h >= 12 : this.pm;
  }

  hour12of(h) { return h % 12 === 0 ? 12 : h % 12; }

  // 1–12 on the dial or the wheel, plus a half of the day, back to 0–23.
  hour24of(h12, pm) { return (h12 % 12) + (pm ? 12 : 0); }

  hourLabel(h) { return this.hour12 ? String(this.hour12of(h)) : this.pad(h); }

  // The one place "how a time reads" is decided — trigger, preview and dial
  // header all come through here, so they can never drift apart.
  display(h, m) {
    if (!this.hour12) return `${this.pad(h)}:${this.pad(m)}`;
    return `${this.hour12of(h)}:${this.pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  /* ---------- clock face geometry ---------- */

  // A ring of twelve-ish marks: the step list when it fits, otherwise an even
  // sample of it, so a step of 1 doesn't crowd sixty numbers onto the dial and
  // no mark ever lands off the step grid.
  clockMinutes() {
    const list = this.minuteList();
    const every = Math.max(1, Math.ceil(list.length / 12));
    const ring = list.filter((_, i) => i % every === 0);
    const p = this.parts;
    if (p && !ring.includes(p.m)) ring.push(p.m);
    return ring.sort((a, b) => a - b);
  }

  // Degrees clockwise from 12 o'clock, radius as a percentage of the dial's
  // width — which is also its height, so one number serves both axes.
  clockPos(deg, radius) {
    const rad = (deg - 90) * (Math.PI / 180);
    return `left:${(50 + radius * Math.cos(rad)).toFixed(2)}%;top:${(50 + radius * Math.sin(rad)).toFixed(2)}%`;
  }

  setClockMode(mode) {
    if (this.clockMode === mode) return;
    this.clockMode = mode;
    if (this.isOpen) { this.renderPop(); this.position(); }
  }

  // Arrow keys: hours by one, minutes by the step, both wrapping. A picker with
  // no value yet starts counting from 00:00.
  nudge(dir) {
    const p = this.parts || { h: 0, m: 0 };
    if (this.clockMode === 'h') {
      this.commit(`${this.pad((p.h + dir + 24) % 24)}:${this.pad(p.m)}`);
    } else {
      const step = this.step;
      const m = ((Math.round(p.m / step) * step) + (dir * step) + 60) % 60;
      this.commit(`${this.pad(p.h)}:${this.pad(m)}`);
    }
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

  // AM/PM moves an existing time across the day; with nothing picked yet there
  // is nothing to move, so it just remembers the half and repaints.
  pickMeridiem(pm) {
    this.pm = pm;
    const p = this.parts;
    if (p && (p.h >= 12) !== pm) {
      this.commit(`${this.pad(pm ? p.h + 12 : p.h - 12)}:${this.pad(p.m)}`);
    } else if (this.isOpen) {
      this.renderPop();
      this.position();
      this.scrollToSelection();
    }
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
    // The dial always opens on hours — that's the pick the user came for.
    this.clockMode = 'h';
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
          --tp-dial-bg: var(--dardanialabs-tp-dial-bg, var(--dardanialabs-tp-hover-bg, #faf6ee));
          --tp-radius: var(--dardanialabs-tp-radius, 12px);
          --tp-popup-radius: var(--dardanialabs-tp-popup-radius, 16px);
          --tp-cell-radius: var(--dardanialabs-tp-cell-radius, 9px);
          --tp-shadow: var(--dardanialabs-tp-shadow, 0 12px 36px rgba(40, 51, 40, 0.14));
          --tp-font-size: var(--dardanialabs-tp-font-size, 1rem);
          --tp-padding: var(--dardanialabs-tp-padding, 0.85rem 1rem);
          --tp-col-height: var(--dardanialabs-tp-col-height, 196px);
          --tp-dial-size: var(--dardanialabs-tp-dial-size, 208px);
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

        /* On the dial the preview is also the mode switch: two halves, the live
           one lit, either one a way back to the other. */
        .preview.mode { padding-bottom: 0.55rem; }
        .part {
          border: none;
          background: transparent;
          font: inherit;
          font-weight: 600;
          font-size: 1.35rem;
          font-variant-numeric: tabular-nums;
          color: var(--tp-muted);
          cursor: pointer;
          padding: 0.05rem 0.35rem;
          border-radius: var(--tp-cell-radius);
          transition: color 0.15s ease, background-color 0.15s ease;
        }
        .part:hover { color: var(--tp-ink); }
        .part.on { color: var(--tp-accent); background: var(--tp-accent-soft); }
        .colon { font-size: 1.35rem; font-weight: 600; color: var(--tp-muted); }

        /* AM/PM rail — the half of the day, shown only when hour12 is on. */
        .mer { display: flex; justify-content: center; gap: 0.3rem; padding-bottom: 0.5rem; }
        .mer button {
          border: 1px solid var(--tp-popup-border);
          background: transparent;
          color: var(--tp-ink);
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          padding: 0.28rem 0.7rem;
          border-radius: var(--tp-cell-radius);
        }
        .mer button:hover:not(.on) { background: var(--tp-hover-bg); color: var(--tp-accent); }
        .mer button.on {
          background: var(--tp-selected-bg);
          border-color: var(--tp-selected-bg);
          color: var(--tp-selected-ink);
        }

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

        /* The dial. Numbers ride a ring by absolute percentage, so the same
           markup serves 12 hours, 24 hours and any minute step. */
        .dial {
          position: relative;
          width: var(--tp-dial-size);
          height: var(--tp-dial-size);
          margin: 0 auto;
          border-radius: 50%;
          background: var(--tp-dial-bg);
        }
        .num {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--tp-ink);
          font-size: 0.85rem;
          font-variant-numeric: tabular-nums;
          border-radius: 50%;
          cursor: pointer;
        }
        .num.in { font-size: 0.7rem; color: var(--tp-muted); }
        .num:hover:not(.sel) { background: var(--tp-hover-bg); color: var(--tp-accent); }
        /* The selected number sits inside the hand's tip, so the tip is its
           background and this is only the ink that reads on top of it. */
        .num.sel { color: var(--tp-selected-ink); font-weight: 600; }

        .hand {
          position: absolute;
          left: 50%;
          bottom: 50%;
          width: 2px;
          margin-left: -1px;
          background: var(--tp-accent);
          transform-origin: bottom center;
          border-radius: 1px;
          pointer-events: none;
        }
        .tip {
          position: absolute;
          top: -15px;
          left: 50%;
          transform: translateX(-50%);
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--tp-accent);
        }
        .pin {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--tp-accent);
          pointer-events: none;
        }

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
      if (act === 'hour') {
        this.pickHour(parseInt(btn.dataset.n, 10));
        // On the dial the hour is only half the errand — hand the ring over.
        if (this.face === 'clock') this.setClockMode('m');
      } else if (act === 'minute') this.pickMinute(parseInt(btn.dataset.n, 10));
      else if (act === 'mer') this.pickMeridiem(btn.dataset.pm === '1');
      else if (act === 'mode') this.setClockMode(btn.dataset.mode);
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
    const text = p ? this.display(p.h, p.m) : '';
    label.classList.toggle('ph', !text);
    // textContent, never innerHTML: attribute text must not become markup.
    label.textContent = text || this.placeholder;
    trigger.setAttribute('aria-label', text || this.placeholder || this.text('dialog'));
  }

  renderPop() {
    const pop = this.shadowRoot.querySelector('.pop');
    if (!pop) return;
    pop.setAttribute('aria-label', this.text('dialog'));
    // Remembered so a later value change knows whether the hour wheel's numbers
    // still mean what they meant when it was built.
    this.renderedPM = this.isPM;

    pop.innerHTML = `
      ${this.previewHTML()}
      ${this.merHTML()}
      ${this.face === 'clock' ? this.dialHTML() : this.colsHTML()}
      <div class="foot" hidden><button type="button" data-act="clear">${this.text('clear')}</button></div>
    `;
    this.syncSelection();
  }

  previewHTML() {
    if (this.face !== 'clock') return '<div class="preview" aria-live="polite"></div>';
    // No whitespace between the halves: the preview still reads as one "09:30".
    return `<div class="preview mode" aria-live="polite">`
      + `<button type="button" class="part" data-act="mode" data-mode="h" aria-label="${this.text('hour')}"></button>`
      + `<span class="colon">:</span>`
      + `<button type="button" class="part" data-act="mode" data-mode="m" aria-label="${this.text('minute')}"></button>`
      + `</div>`;
  }

  merHTML() {
    if (!this.hour12) return '';
    return `<div class="mer" role="group" aria-label="AM / PM">
        <button type="button" data-act="mer" data-pm="0">AM</button>
        <button type="button" data-act="mer" data-pm="1">PM</button>
      </div>`;
  }

  // Both wheels; hour12 only renumbers the hour one — 12, 1 … 11 on the face,
  // the 24-hour value it stands for on data-n.
  colsHTML() {
    const pm = this.isPM;
    const hourValues = this.hour12
      ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      : Array.from({ length: 24 }, (_, h) => h);
    const hours = hourValues.map((h) => {
      const n = this.hour12 ? this.hour24of(h, pm) : h;
      return `<button type="button" class="opt" data-act="hour" data-n="${n}" data-kind="h">${this.hour12 ? h : this.pad(h)}</button>`;
    }).join('');
    const minutes = this.minuteList().map((m) =>
      `<button type="button" class="opt" data-act="minute" data-n="${m}" data-kind="m">${this.pad(m)}</button>`).join('');

    return `<div class="cols">
        <div>
          <div class="cap">${this.text('hour')}</div>
          <div class="col" role="group" aria-label="${this.text('hour')}">${hours}</div>
        </div>
        <div>
          <div class="cap">${this.text('minute')}</div>
          <div class="col" role="group" aria-label="${this.text('minute')}">${minutes}</div>
        </div>
      </div>`;
  }

  // The dial: one ring of minutes, or one ring of hours in hour12 and two in
  // 24-hour — 1–12 outside, 13–23 and 00 inside, the way a 24-hour clock reads.
  dialHTML() {
    const OUT = 38;
    const IN = 24;
    const p = this.parts;
    const marks = [];
    let hand = '';

    if (this.clockMode === 'h') {
      const pm = this.isPM;
      for (let h = 1; h <= 12; h += 1) {
        const n = this.hour12 ? this.hour24of(h, pm) : h;
        marks.push(`<button type="button" class="num" data-act="hour" data-n="${n}" data-kind="h"
          style="${this.clockPos(h * 30, OUT)}">${h}</button>`);
      }
      if (!this.hour12) {
        for (let h = 13; h <= 24; h += 1) {
          const n = h === 24 ? 0 : h;
          marks.push(`<button type="button" class="num in" data-act="hour" data-n="${n}" data-kind="h"
            style="${this.clockPos((h - 12) * 30, IN)}">${this.pad(n)}</button>`);
        }
      }
      if (p) hand = this.handHTML((p.h % 12) * 30, !this.hour12 && (p.h === 0 || p.h > 12) ? IN : OUT);
    } else {
      this.clockMinutes().forEach((m) => {
        marks.push(`<button type="button" class="num" data-act="minute" data-n="${m}" data-kind="m"
          style="${this.clockPos(m * 6, OUT)}">${this.pad(m)}</button>`);
      });
      if (p) hand = this.handHTML(p.m * 6, OUT);
    }

    return `<div class="dial" role="group" aria-label="${this.text(this.clockMode === 'h' ? 'hour' : 'minute')}">
        ${hand}<div class="pin"></div>${marks.join('')}
      </div>`;
  }

  // Drawn before the numbers so its tip becomes their selected background.
  handHTML(deg, len) {
    return `<div class="hand" style="height:${len}%;transform:rotate(${deg}deg)"><span class="tip"></span></div>`;
  }

  // Targeted update instead of a re-render: the columns keep their scroll.
  syncSelection() {
    const pop = this.shadowRoot.querySelector('.pop');
    if (!pop || !pop.querySelector('.preview')) return;
    const p = this.parts;
    const preview = pop.querySelector('.preview');
    const parts = pop.querySelectorAll('.part');
    if (parts.length) {
      parts[0].textContent = p ? this.hourLabel(p.h) : '--';
      parts[1].textContent = p ? this.pad(p.m) : '--';
      parts.forEach((b) => b.classList.toggle('on', b.dataset.mode === this.clockMode));
    } else {
      preview.textContent = p ? this.display(p.h, p.m) : '--:--';
    }
    preview.classList.toggle('empty', !p);
    pop.querySelectorAll('.opt, .num').forEach((opt) => {
      const n = parseInt(opt.dataset.n, 10);
      const sel = Boolean(p) && (opt.dataset.kind === 'h' ? n === p.h : n === p.m);
      opt.classList.toggle('sel', sel);
      opt.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
    pop.querySelectorAll('.mer button').forEach((b) => {
      const on = (b.dataset.pm === '1') === this.isPM;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    pop.querySelector('.foot').hidden = !(this.clearable && this.value);
  }
}

if (!customElements.get('dardanialabs-timepicker')) {
  customElements.define('dardanialabs-timepicker', DardaniaLabsTimepicker);
}
