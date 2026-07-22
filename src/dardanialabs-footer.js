/**
 * Footer Web Component
 * Copyright line + social links.
 *
 * Social values resolve from two places, in this order:
 *   1. a remote source  (see below)                      <- wins
 *   2. the element's attributes (facebook="https://…")   <- fallback
 *
 * That lets an owner manage their own links remotely with no redeploy, while
 * a page with nothing configured (or a failed/slow fetch) still renders
 * whatever was hardcoded.
 *
 * The remote source is deliberately generic so anyone can reuse this:
 *
 *   <!-- any endpoint, any shape -->
 *   <x-footer src="https://example.com/social.json"></x-footer>
 *
 *   <!-- convenience for a DardaniaLabs CMS tenant -->
 *   <x-footer client-id="rec_…" api="https://api.dardanialabs.io/v1/public"></x-footer>
 *
 * Accepted response shapes (all handled):
 *   { "records": [ { "type": "facebook", "info_value": "https://…" } ] }
 *   [ { "type": "facebook", "info_value": "https://…" } ]
 *   { "facebook": "https://…", "whatsapp": "+47 900 00 000" }
 * and each value may be a plain string, a JSON string, or an i18n object.
 *
 * Adding a platform = one PLATFORMS entry + one ICONS entry.
 *
 * The built-in icons are just defaults — anyone embedding this can override
 * them, or add platforms of their own, without forking the file.
 *
 * Declaratively, straight from the markup:
 *
 *   <!-- swap icons: a map, or a list of objects -->
 *   <x-footer icons='{"viber":"<svg …>"}'></x-footer>
 *   <x-footer icons='[{"key":"telegram","label":"Telegram",
 *                      "kind":"url","icon":"<svg …>"}]'
 *             telegram="https://t.me/acme"></x-footer>
 *
 *   <!-- choose which platforms show, and in what order -->
 *   <x-footer platforms="facebook,instagram,viber"></x-footer>
 *   <x-footer platforms='["viber","facebook"]'></x-footer>
 *
 * Or from JavaScript:
 *
 *   const Footer = customElements.get('dardanialabs-footer');
 *
 *   // swap one icon everywhere
 *   Footer.setIcon('viber', '<svg viewBox="0 0 24 24">…</svg>');
 *
 *   // add a platform this component has never heard of
 *   Footer.registerPlatform({ key: 'telegram', label: 'Telegram',
 *                             kind: 'url', icon: '<svg …>' });
 *
 *   // or override on a single element only
 *   document.querySelector('dardanialabs-footer').icons = { viber: '<svg …>' };
 *
 * Icons inherit the surrounding text colour via `fill: currentColor`, so an
 * override should avoid hardcoded fills if it wants to keep theming.
 * Live elements re-render automatically when an override is applied.
 */

// kind: 'url'          -> value is a link
//       'phone_or_url' -> value may be a phone number; the link is built from it
const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', kind: 'url' },
  { key: 'instagram', label: 'Instagram', kind: 'url' },
  { key: 'tiktok', label: 'TikTok', kind: 'url' },
  { key: 'youtube', label: 'YouTube', kind: 'url' },
  { key: 'x', label: 'X', kind: 'url' },
  { key: 'snapchat', label: 'Snapchat', kind: 'url' },
  { key: 'linkedin', label: 'LinkedIn', kind: 'url' },
  { key: 'whatsapp', label: 'WhatsApp', kind: 'phone_or_url' },
  { key: 'viber', label: 'Viber', kind: 'phone_or_url' },
];

let PLATFORM_KEYS = PLATFORMS.map((p) => p.key);

// every connected element, so an icon override can refresh what is on screen
const INSTANCES = new Set();

class DardaniaLabsFooter extends HTMLElement {
  static get observedAttributes() {
    return [
      'company', 'founded', 'developer', 'developer-url',
      'align', 'color', 'font-size', 'social-gap', 'gap', 'icon-size',
      'src', 'client-id', 'api', 'icons', 'platforms',
      ...PLATFORM_KEYS,
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._remote = {};   // values loaded from the CMS
    this._loaded = false; // fetch runs once per element
  }

  connectedCallback() {
    INSTANCES.add(this);
    this.render();
    this.loadRemote();
  }

  disconnectedCallback() {
    INSTANCES.delete(this);
  }

  attributeChangedCallback() {
    this.render();
  }

  /* ---------- icon overrides ---------- */

  // per-element override: el.icons = { viber: '<svg …>' }
  set icons(map) {
    this._icons = map && typeof map === 'object' ? map : null;
    this.render();
  }

  get icons() {
    return this._icons || {};
  }

  // `icons` attribute — a map, or a list of objects:
  //   icons='{"viber":"<svg …>"}'
  //   icons='[{"key":"telegram","label":"Telegram","kind":"url","icon":"<svg …>"}]'
  parsedIconAttribute() {
    const raw = this.getAttribute('icons');
    if (!raw) return { icons: {}, definitions: [] };
    if (this._iconAttrCache && this._iconAttrCache.raw === raw) return this._iconAttrCache.value;

    const icons = {};
    const definitions = [];
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : null;
      if (list) {
        for (const entry of list) {
          if (!entry || !entry.key) continue;
          if (entry.icon) icons[entry.key] = entry.icon;
          definitions.push({
            key: entry.key,
            label: entry.label || entry.key,
            kind: entry.kind === 'phone_or_url' ? 'phone_or_url' : 'url',
          });
        }
      } else if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(parsed)) {
          if (typeof parsed[key] === 'string') icons[key] = parsed[key];
        }
      }
    } catch (error) {
      // malformed JSON falls back to the built-in icons
    }
    const value = { icons, definitions };
    this._iconAttrCache = { raw, value };
    return value;
  }

  // `platforms` attribute — a plain list of keys choosing which render, and in
  // what order:  platforms="facebook,instagram,viber"  or  '["facebook","viber"]'
  platformFilter() {
    const raw = (this.getAttribute('platforms') || '').trim();
    if (!raw) return [];
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
      } catch (error) { /* fall through to the split below */ }
    }
    return raw.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
  }

  // built-ins, plus anything the icons attribute defined, narrowed/ordered by
  // the platforms attribute when present
  effectivePlatforms() {
    const list = PLATFORMS.slice();
    for (const definition of this.parsedIconAttribute().definitions) {
      const index = list.findIndex((p) => p.key === definition.key);
      if (index === -1) list.push(definition);
      else list[index] = { ...list[index], ...definition };
    }
    const filter = this.platformFilter();
    if (!filter.length) return list;
    return filter.map(
      (key) => list.find((p) => p.key === key) || { key, label: key, kind: 'url' }
    );
  }

  // precedence: per-element property > icons attribute > built-in
  iconFor(key) {
    return (this._icons && this._icons[key])
      || this.parsedIconAttribute().icons[key]
      || ICONS[key]
      || '';
  }

  // Replace a built-in icon everywhere.
  static setIcon(key, svg) {
    ICONS[key] = svg;
    INSTANCES.forEach((el) => el.render());
  }

  // Add (or replace) a platform, optionally with its icon. Call this before
  // the elements are created if you also want its attribute observed.
  static registerPlatform(definition) {
    if (!definition || !definition.key) return;
    const entry = {
      key: definition.key,
      label: definition.label || definition.key,
      kind: definition.kind === 'phone_or_url' ? 'phone_or_url' : 'url',
    };
    const index = PLATFORMS.findIndex((p) => p.key === entry.key);
    if (index === -1) PLATFORMS.push(entry);
    else PLATFORMS[index] = entry;
    PLATFORM_KEYS = PLATFORMS.map((p) => p.key);
    if (definition.icon) ICONS[entry.key] = definition.icon;
    INSTANCES.forEach((el) => el.render());
  }

  static get platforms() {
    return PLATFORMS;
  }

  /* ---------- plain attributes ---------- */

  get company() { return this.getAttribute('company') || ''; }
  get founded() { return this.getAttribute('founded') || ''; }
  get developer() { return this.getAttribute('developer') || ''; }
  get developerUrl() { return this.getAttribute('developer-url') || ''; }
  get color() { return this.getAttribute('color') || ''; }
  get fontSize() { return this.getAttribute('font-size') || ''; }
  get socialGap() { return this.getAttribute('social-gap') || '2rem'; }
  // Viber and Instagram are outline marks with fine detail; below ~24px they
  // muddy into a squiggle while solid marks like Facebook still read fine.
  get iconSize() { return this.getAttribute('icon-size') || '26px'; }
  get gap() { return this.getAttribute('gap') || '0.5rem'; }
  get src() { return this.getAttribute('src') || ''; }
  get clientId() { return this.getAttribute('client-id') || ''; }
  // only used together with client-id; overridable for any other deployment
  get api() { return this.getAttribute('api') || 'https://api.dardanialabs.io/v1/public'; }

  // `src` wins; otherwise build the tenant URL from client-id + api
  get feedUrl() {
    if (this.src) return this.src;
    if (this.clientId) return `${this.api}/${this.clientId}/tables/site_content/records`;
    return '';
  }

  get align() {
    const val = this.getAttribute('align') || 'center';
    if (val === 'start' || val === 'left') return 'flex-start';
    if (val === 'end' || val === 'right') return 'flex-end';
    return 'center';
  }

  /* ---------- value resolution ---------- */

  // CMS value wins; the attribute is the fallback.
  valueFor(key) {
    return (this._remote[key] || this.getAttribute(key) || '').trim();
  }

  // Build the href for a platform. Accepts a full URL, a bare domain, or —
  // for WhatsApp/Viber — a plain phone number as a client would naturally type it.
  hrefFor(platform, value) {
    if (/^[a-z]+:/i.test(value)) return value; // already a full URL / scheme
    if (platform.kind === 'phone_or_url') {
      const digits = value.replace(/\D/g, '');
      if (!digits) return '';
      if (platform.key === 'whatsapp') return `https://wa.me/${digits}`;
      if (platform.key === 'viber') return `viber://chat?number=%2B${digits}`;
    }
    return `https://${value.replace(/^\/+/, '')}`;
  }

  /* ---------- CMS ---------- */

  // A value may be a plain string, a JSON string, or an i18n object
  // ({ no: "...", en: "..." }). Take the first usable string.
  static readValue(raw) {
    let value = raw;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch (e) { /* plain string */ }
    }
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') {
      const text = Object.values(value).find((v) => typeof v === 'string' && v.trim());
      return typeof text === 'string' ? text.trim() : '';
    }
    return '';
  }

  // Pull platform -> value out of whatever shape the endpoint returned, so
  // this works against any backend, not just the DardaniaLabs CMS.
  static extractSocials(payload) {
    const out = {};
    const rows = Array.isArray(payload) ? payload
      : (payload && Array.isArray(payload.records)) ? payload.records
        : null;

    if (rows) {
      // row shape: { type|name|platform, info_value|value|url }
      for (const row of rows) {
        if (!row) continue;
        const key = String(row.type || row.name || row.platform || '').toLowerCase();
        if (!PLATFORM_KEYS.includes(key)) continue;
        const raw = row.info_value !== undefined ? row.info_value
          : row.value !== undefined ? row.value : row.url;
        const text = DardaniaLabsFooter.readValue(raw);
        if (text) out[key] = text;
      }
      return out;
    }

    // flat shape: { facebook: "...", whatsapp: "+47 …" }
    if (payload && typeof payload === 'object') {
      for (const key of PLATFORM_KEYS) {
        const text = DardaniaLabsFooter.readValue(payload[key]);
        if (text) out[key] = text;
      }
    }
    return out;
  }

  async loadRemote() {
    const url = this.feedUrl;
    if (this._loaded || !url) return;
    this._loaded = true;
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return; // keep attribute fallbacks
      const found = DardaniaLabsFooter.extractSocials(await response.json());
      let changed = false;
      for (const key of Object.keys(found)) {
        if (this._remote[key] !== found[key]) {
          this._remote[key] = found[key];
          changed = true;
        }
      }
      if (changed) this.render();
    } catch (error) {
      // network failure leaves the hardcoded attributes in place
    }
  }

  /* ---------- render ---------- */

  render() {
    const currentYear = new Date().getFullYear();
    const yearRange = !this.founded || this.founded === String(currentYear)
      ? currentYear
      : `${this.founded} - ${currentYear}`;

    const socials = this.effectivePlatforms().reduce((out, platform) => {
      const value = this.valueFor(platform.key);
      if (!value) return out;
      const href = this.hrefFor(platform, value);
      if (!href) return out;
      // app-scheme links (viber://) must open in place, not a blank tab
      const isWeb = /^https?:/i.test(href);
      const target = isWeb ? ' target="_blank" rel="noopener"' : '';
      out.push(
        `<a href="${href}"${target} aria-label="${platform.label}">${this.iconFor(platform.key)}</a>`
      );
      return out;
    }, []);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: inherit;
          color: ${this.color || 'inherit'};
          ${this.fontSize ? `font-size: ${this.fontSize};` : ''}
          padding: 0;
          margin: 0;
        }

        .container {
          display: flex;
          flex-direction: column;
          align-items: ${this.align};
        }

        .socials {
          display: flex;
          gap: ${this.socialGap};
          margin-bottom: ${this.gap};
        }

        .socials a {
          display: flex;
          align-items: center;
          justify-content: center;
          color: inherit;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .socials a:visited {
          color: inherit;
        }

        .socials a:hover {
          opacity: 0.7;
        }

        .socials svg {
          display: block;      /* no inline baseline gap, so every icon sits identically */
          width: ${this.iconSize};
          height: ${this.iconSize};
          fill: currentColor;
        }

        .copyright {
          margin: 0;
        }

        .copyright a {
          color: inherit;
          text-decoration: none;
          cursor: pointer;
        }

        .copyright a:visited {
          color: inherit;
        }
      </style>

      <div class="container">
        ${socials.length > 0 ? `<div class="socials">${socials.join('')}</div>` : ''}
        <p class="copyright">
          &copy; ${yearRange}${this.company ? ` ${this.company}` : ''}${this.developer ? ` | ${this.developerUrl ? `<a href="${this.developerUrl}" target="_blank" rel="noopener">${this.developer}</a>` : this.developer}` : ''}
        </p>
      </div>
    `;
  }
}

const ICONS = {
  facebook: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg>`,
  snapchat: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`,
  viber: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.696 6.7.633 9.817.57 12.933.488 18.776 6.12 20.36h.003l-.004 2.416s-.037.977.61 1.177c.777.242 1.234-.5 1.98-1.302.407-.44.972-1.084 1.397-1.58 3.85.326 6.812-.416 7.15-.525.776-.252 5.176-.816 5.892-6.657.74-6.02-.36-9.83-2.34-11.546-.596-.55-3.006-2.3-8.375-2.323 0 0-.395-.025-1.037-.017zm.058 1.693c.545-.004.88.017.88.017 4.542.02 6.717 1.388 7.222 1.846 1.675 1.435 2.53 4.868 1.906 9.897v.002c-.604 4.878-4.174 5.184-4.832 5.395-.28.09-2.882.737-6.153.524 0 0-2.436 2.94-3.197 3.704-.12.12-.26.167-.352.144-.13-.033-.166-.188-.165-.414l.02-4.018c-4.762-1.32-4.485-6.292-4.43-8.895.054-2.604.543-4.738 1.996-6.173 1.96-1.773 5.474-2.018 7.11-2.03zm.38 2.602c-.167 0-.303.135-.304.302 0 .167.133.303.3.305 1.624.01 2.946.537 4.028 1.592 1.073 1.046 1.62 2.468 1.633 4.334.002.167.14.3.307.3.166-.002.3-.138.3-.304-.014-1.984-.618-3.596-1.816-4.764-1.19-1.16-2.692-1.753-4.447-1.765zm-3.96.695c-.19-.032-.4.005-.616.117l-.01.002c-.43.247-.816.562-1.146.932-.002.004-.006.004-.008.008-.267.323-.42.638-.46.948-.008.046-.01.093-.007.14 0 .136.022.27.065.4l.013.01c.135.48.473 1.276 1.205 2.604.42.768.903 1.5 1.446 2.186.27.344.56.673.87.984l.132.132c.31.308.64.6.984.87.686.543 1.418 1.027 2.186 1.447 1.328.733 2.126 1.07 2.604 1.206l.01.014c.13.042.265.064.402.063.046.002.092 0 .138-.008.31-.036.627-.19.948-.46.004 0 .003-.002.008-.005.37-.33.683-.72.93-1.148l.003-.01c.225-.432.15-.842-.18-1.12-.004 0-.698-.58-1.037-.83-.36-.255-.73-.492-1.113-.71-.51-.285-1.032-.106-1.248.174l-.447.564c-.23.283-.657.246-.657.246-3.12-.796-3.955-3.955-3.955-3.955s-.037-.426.248-.656l.563-.448c.277-.215.456-.737.17-1.248-.217-.383-.454-.756-.71-1.115-.25-.34-.826-1.033-.83-1.035-.137-.165-.31-.265-.502-.297zm4.49.88c-.158.002-.29.124-.3.282-.01.167.115.312.282.324 1.16.085 2.017.466 2.645 1.15.63.688.93 1.524.906 2.57-.002.168.13.306.3.31.166.003.305-.13.31-.297.025-1.175-.334-2.193-1.067-2.994-.74-.81-1.777-1.253-3.05-1.346h-.024zm.463 1.63c-.16.002-.29.127-.3.287-.008.167.12.31.288.32.523.028.875.175 1.113.422.24.245.388.62.416 1.164.01.167.15.295.318.287.167-.008.295-.15.287-.317-.03-.644-.215-1.178-.58-1.557-.367-.378-.893-.574-1.52-.607h-.018z"/></svg>`,
};

if (!customElements.get('dardanialabs-footer')) {
  customElements.define('dardanialabs-footer', DardaniaLabsFooter);
}

// legacy alias retained during dardanialabs migration
class LegacyDardaniaLabsFooter extends DardaniaLabsFooter {}
if (!customElements.get('rtek-footer')) {
  customElements.define('rtek-footer', LegacyDardaniaLabsFooter);
}
