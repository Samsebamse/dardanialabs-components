/**
 * Generic Mail Form Web Component
 * Contact form that submits through the platform mail API
 * (POST {api}/mail with { data: { name, mobile, email, subject, message, lang } };
 * the server resolves the tenant from the Origin header and routes the mail).
 *
 * Validation is fully custom: per-field messages, highlight + focus on the
 * first invalid field, a tip box for the code format, live code formatting.
 *
 * Usage:
 *   <dardanialabs-mailform
 *     api="https://api.dardanialabs.io/v1/public"
 *     lang="no"
 *     require-code
 *     show-mobile
 *     show-subject
 *   ></dardanialabs-mailform>
 *
 * Attributes:
 *   api           API base (default https://api.dardanialabs.io/v1/public)
 *   lang          no | en | sq (default no)
 *   require-code  adds a mandatory code field (3 letters + 2 digits by default)
 *   code-pattern  override regex source for the code (default [A-ZÆØÅ]{3}[0-9]{2})
 *   code-example  example shown in placeholder/tip (default ABC12)
 *   show-mobile   adds an optional phone field
 *   show-subject  adds a subject field
 *
 * Theming (CSS custom properties on the host):
 *   --dardanialabs-accent     accent color (buttons, focus)   default #c4622d
 *   --dardanialabs-text       text color                      default #2c2c2c
 *   --dardanialabs-bg         form background                 default #ffffff
 *   --dardanialabs-input-bg   input background                default #faf7f2
 *   --dardanialabs-border     input border color              default #ddd5c8
 *   --dardanialabs-radius     corner radius                   default 12px
 *   --dardanialabs-error      error color                     default #b3402a
 *   --dardanialabs-success    success color                   default #3d5142
 *
 * Events: dispatches 'dardanialabs-mailform:sent' and 'dardanialabs-mailform:error'
 * (each is also fired under its pre-rename name for older listeners).
 */

const STRINGS = {
  no: {
    name: 'Navn', namePh: 'Ditt navn', nameErr: 'Skriv inn navnet ditt.',
    email: 'E-post', emailPh: 'navn@epost.no', emailErr: 'Skriv inn en gyldig e-postadresse.',
    mobile: 'Telefon (valgfritt)', mobilePh: 'f.eks. 900 00 000',
    subject: 'Emne', subjectPh: 'Hva gjelder det?', subjectDefault: 'Melding fra nettsiden',
    code: 'Kode', codeErr: 'Koden må være 3 bokstaver etterfulgt av 2 siffer – 5 tegn totalt.',
    codeTip: 'Koden er 5 tegn: 3 bokstaver + 2 siffer, f.eks.',
    message: 'Melding', messagePh: 'Skriv meldingen din her …', messageErr: 'Skriv en melding.',
    requiredErr: 'Dette feltet er påkrevd.',
    send: 'Send melding', sending: 'Sender …',
    sentTitle: 'Takk for meldingen!', sentBody: 'Vi tar kontakt så snart som mulig.',
    failed: 'Noe gikk galt ved sending. Prøv igjen, eller kontakt oss direkte på e-post.',
  },
  en: {
    name: 'Name', namePh: 'Your name', nameErr: 'Please enter your name.',
    email: 'Email', emailPh: 'name@email.com', emailErr: 'Please enter a valid email address.',
    mobile: 'Phone (optional)', mobilePh: 'e.g. +47 900 00 000',
    subject: 'Subject', subjectPh: 'What is it about?', subjectDefault: 'Message from the website',
    code: 'Code', codeErr: 'The code must be 3 letters followed by 2 digits — 5 characters in total.',
    codeTip: 'The code is 5 characters: 3 letters + 2 digits, e.g.',
    message: 'Message', messagePh: 'Write your message here …', messageErr: 'Please write a message.',
    requiredErr: 'This field is required.',
    send: 'Send message', sending: 'Sending …',
    sentTitle: 'Thank you!', sentBody: 'We will get back to you as soon as possible.',
    failed: 'Something went wrong. Please try again, or contact us directly by email.',
  },
  sq: {
    name: 'Emri', namePh: 'Emri juaj', nameErr: 'Ju lutem shkruani emrin tuaj.',
    email: 'Email', emailPh: 'emri@email.com', emailErr: 'Ju lutem shkruani një adresë email të vlefshme.',
    mobile: 'Telefoni (opsional)', mobilePh: 'p.sh. +383 44 000 000',
    subject: 'Subjekti', subjectPh: 'Për çfarë bëhet fjalë?', subjectDefault: 'Mesazh nga faqja',
    code: 'Kodi', codeErr: 'Kodi duhet të ketë 3 shkronja të ndjekura nga 2 shifra — gjithsej 5 karaktere.',
    codeTip: 'Kodi ka 5 karaktere: 3 shkronja + 2 shifra, p.sh.',
    message: 'Mesazhi', messagePh: 'Shkruani mesazhin tuaj këtu …', messageErr: 'Ju lutem shkruani një mesazh.',
    requiredErr: 'Kjo fushë është e detyrueshme.',
    send: 'Dërgo mesazhin', sending: 'Duke dërguar …',
    sentTitle: 'Faleminderit!', sentBody: 'Do t’ju kontaktojmë sa më shpejt.',
    failed: 'Diçka shkoi keq. Provoni përsëri ose na kontaktoni direkt me email.',
  },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class DardaniaLabsMailform extends HTMLElement {
  static get observedAttributes() {
    return ['api', 'lang', 'require-code', 'code-pattern', 'code-example', 'show-mobile', 'show-subject', 'fields'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.busy = false;
  }

  connectedCallback() { this.render(); }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) this.render();
  }

  get api() { return this.getAttribute('api') || 'https://api.dardanialabs.io/v1/public'; }
  set api(value) { this.setAttribute('api', value); }
  get lang() {
    const lang = (this.getAttribute('lang') || 'no').toLowerCase();
    return STRINGS[lang] ? lang : 'no';
  }
  // Frameworks (Vue, React) set `lang` as a DOM property because it exists on
  // every element — without this setter the getter above would shadow the
  // native reflection and the assignment would be silently lost
  set lang(value) {
    this.setAttribute('lang', value);
  }
  get t() { return STRINGS[this.lang]; }
  get requireCode() { return this.hasAttribute('require-code'); }
  get codePattern() {
    return new RegExp(`^${this.getAttribute('code-pattern') || '[A-ZÆØÅ]{3}[0-9]{2}'}$`);
  }
  get codeExample() { return this.getAttribute('code-example') || 'ABC12'; }
  get showMobile() { return this.hasAttribute('show-mobile'); }
  get showSubject() { return this.hasAttribute('show-subject'); }

  // Localize a value that may be a plain string or a { no, en, sq } object
  loc(value) {
    if (value && typeof value === 'object') {
      return value[this.lang] ?? Object.values(value)[0] ?? '';
    }
    return value ?? '';
  }

  /**
   * Extra inputs, declared as JSON on the `fields` attribute. Each entry:
   *   { name, label, type: 'text'|'tel'|'select'|'textarea',
   *     options: [...], placeholder, required }
   * label / placeholder / options entries may be strings or { no, en, sq }
   * objects. Values are folded into the message body as "Label: value" lines.
   */
  get extraFields() {
    try {
      const parsed = JSON.parse(this.getAttribute('fields') || '[]');
      return (Array.isArray(parsed) ? parsed : []).filter((f) => f && f.name && f.label);
    } catch {
      return [];
    }
  }

  field(name) { return this.shadowRoot.querySelector(`[name="${name}"]`); }

  setError(name, message) {
    const input = this.field(name);
    const error = this.shadowRoot.querySelector(`.error[data-for="${name}"]`);
    if (!input || !error) return !message;
    input.classList.toggle('invalid', Boolean(message));
    error.textContent = message || '';
    error.style.display = message ? 'block' : 'none';
    return !message;
  }

  validate(name) {
    const t = this.t;
    const value = (this.field(name)?.value || '').trim();
    switch (name) {
      case 'name': return this.setError('name', value ? '' : t.nameErr);
      case 'email': return this.setError('email', EMAIL_PATTERN.test(value) ? '' : t.emailErr);
      case 'code': return this.setError('code', this.codePattern.test(value) ? '' : t.codeErr);
      case 'message': return this.setError('message', value ? '' : t.messageErr);
      default: return true;
    }
  }

  async submit() {
    if (this.busy) return;
    const required = ['name', 'email', ...(this.requireCode ? ['code'] : []), 'message'];
    let firstInvalid = null;
    for (const name of required) {
      if (!this.validate(name) && !firstInvalid) firstInvalid = name;
    }
    for (const f of this.extraFields) {
      if (!f.required) continue;
      const key = `x-${f.name}`;
      const filled = Boolean((this.field(key)?.value || '').trim());
      if (!this.setError(key, filled ? '' : this.t.requiredErr) && !firstInvalid) firstInvalid = key;
    }
    if (firstInvalid) {
      const el = this.field(firstInvalid);
      el?.focus?.();
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }

    const t = this.t;
    const button = this.shadowRoot.querySelector('.submit');
    this.busy = true;
    button.disabled = true;
    button.textContent = t.sending;
    this.shadowRoot.querySelector('.form-failed').style.display = 'none';

    const code = this.requireCode ? this.field('code').value.trim() : '';
    // An extra field named "subject" becomes the mail's actual subject
    // instead of a message-body line
    const extraSubject = this.extraFields.some((f) => f.name === 'subject')
      ? (this.field('x-subject')?.value || '').trim()
      : '';
    const extraLines = this.extraFields
      .filter((f) => f.name !== 'subject')
      .map((f) => ({ label: this.loc(f.label), value: (this.field(`x-${f.name}`)?.value || '').trim() }))
      .filter((x) => x.value)
      .map((x) => `${x.label}: ${x.value}`);
    const header = [code ? `${t.code}: ${code}` : '', ...extraLines].filter(Boolean).join('\n');
    const message = (header ? `${header}\n\n` : '') + this.field('message').value.trim();
    const payload = {
      data: {
        name: this.field('name').value.trim(),
        mobile: this.showMobile ? (this.field('mobile')?.value.trim() || '') : '',
        email: this.field('email').value.trim(),
        subject: (this.showSubject && this.field('subject')?.value.trim())
          || extraSubject
          || t.subjectDefault,
        message,
        lang: this.lang,
      },
    };

    try {
      const response = await fetch(`${this.api}/mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Mail request failed (${response.status})`);
      this.shadowRoot.querySelector('form').style.display = 'none';
      this.shadowRoot.querySelector('.form-sent').style.display = 'block';
      this.dispatchEvent(new CustomEvent('dardanialabs-mailform:sent', { bubbles: true, composed: true }));
      // legacy alias retained during dardanialabs migration
      this.dispatchEvent(new CustomEvent('rtek-mailform:sent', { bubbles: true, composed: true }));
    } catch (error) {
      this.shadowRoot.querySelector('.form-failed').style.display = 'block';
      this.dispatchEvent(new CustomEvent('dardanialabs-mailform:error', { bubbles: true, composed: true, detail: error }));
      // legacy alias retained during dardanialabs migration
      this.dispatchEvent(new CustomEvent('rtek-mailform:error', { bubbles: true, composed: true, detail: error }));
    } finally {
      this.busy = false;
      button.disabled = false;
      button.textContent = t.send;
    }
  }

  // legacy alias retained during dardanialabs migration
  // (every var() read below falls back from --dardanialabs-* to the old
  //  --rtek-* name so pages themed before the rename keep their look)
  render() {
    const t = this.t;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: inherit;
          color: var(--dardanialabs-text, var(--rtek-text, #2c2c2c));
        }
        form {
          background: var(--dardanialabs-bg, var(--rtek-bg, #ffffff));
          border-radius: calc(var(--dardanialabs-radius, var(--rtek-radius, 12px)) + 6px);
          padding: 2.2rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          box-shadow: 0 10px 34px rgba(0, 0, 0, 0.08);
        }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; }
        .field { display: flex; flex-direction: column; gap: 0.4rem; position: relative; }
        label { font-size: 0.85rem; font-weight: 600; }
        input, textarea, select {
          font: inherit;
          padding: 0.85rem 1rem;
          border: 1px solid var(--dardanialabs-border, var(--rtek-border, #ddd5c8));
          border-radius: var(--dardanialabs-radius, var(--rtek-radius, 12px));
          background: var(--dardanialabs-input-bg, var(--rtek-input-bg, #faf7f2));
          color: inherit;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: var(--dardanialabs-accent, var(--rtek-accent, #c4622d));
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--dardanialabs-accent, var(--rtek-accent, #c4622d)) 18%, transparent);
        }
        textarea { resize: vertical; min-height: 110px; }
        input.invalid, textarea.invalid {
          border-color: var(--dardanialabs-error, var(--rtek-error, #b3402a));
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--dardanialabs-error, var(--rtek-error, #b3402a)) 16%, transparent);
          animation: shake 0.3s ease;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .error { display: none; font-size: 0.84rem; font-weight: 500; color: var(--dardanialabs-error, var(--rtek-error, #b3402a)); }
        .code-wrap { position: relative; }
        .code-wrap input { letter-spacing: 0.25em; font-weight: 600; text-transform: uppercase; }
        .code-check {
          position: absolute; right: 1rem; top: 50%; transform: translateY(-50%);
          color: var(--dardanialabs-success, var(--rtek-success, #3d5142)); font-weight: 700; display: none; pointer-events: none;
        }
        input.valid { border-color: var(--dardanialabs-success, var(--rtek-success, #3d5142)); }
        input.valid ~ .code-check { display: block; }
        .tip {
          display: none;
          align-items: flex-start;
          gap: 0.5rem;
          background: color-mix(in srgb, var(--dardanialabs-accent, var(--rtek-accent, #c4622d)) 8%, var(--dardanialabs-bg, var(--rtek-bg, #fff)));
          border: 1px solid var(--dardanialabs-border, var(--rtek-border, #ddd5c8));
          border-left: 3px solid var(--dardanialabs-accent, var(--rtek-accent, #c4622d));
          border-radius: 10px;
          padding: 0.65rem 0.85rem;
          font-size: 0.86rem;
        }
        .tip.show { display: flex; }
        .submit {
          font: inherit;
          font-weight: 600;
          border: none;
          cursor: pointer;
          background: var(--dardanialabs-accent, var(--rtek-accent, #c4622d));
          color: #fff;
          padding: 0.95rem 1.4rem;
          border-radius: 50px;
          transition: filter 0.2s ease, transform 0.15s ease;
        }
        .submit:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .submit:disabled { opacity: 0.7; cursor: wait; }
        .form-sent {
          display: none;
          background: var(--dardanialabs-bg, var(--rtek-bg, #fff));
          border-radius: calc(var(--dardanialabs-radius, var(--rtek-radius, 12px)) + 6px);
          padding: 2.6rem 2.2rem;
          text-align: center;
          box-shadow: 0 10px 34px rgba(0, 0, 0, 0.08);
        }
        .form-sent h3 { margin: 0 0 0.5rem; color: var(--dardanialabs-success, var(--rtek-success, #3d5142)); }
        .form-sent p { margin: 0; }
        .form-failed {
          display: none;
          color: var(--dardanialabs-error, var(--rtek-error, #b3402a));
          background: color-mix(in srgb, var(--dardanialabs-error, var(--rtek-error, #b3402a)) 10%, transparent);
          border-radius: 10px;
          padding: 0.8rem 1rem;
          font-size: 0.9rem;
          font-weight: 500;
        }
        @media (max-width: 560px) {
          form { padding: 1.5rem; }
          .row { grid-template-columns: 1fr; }
        }
      </style>

      <form novalidate>
        <div class="field">
          <label>${t.name}</label>
          <input name="name" type="text" placeholder="${t.namePh}" />
          <span class="error" data-for="name"></span>
        </div>
        <div class="${this.showMobile ? 'row' : ''}">
          <div class="field">
            <label>${t.email}</label>
            <input name="email" type="email" placeholder="${t.emailPh}" />
            <span class="error" data-for="email"></span>
          </div>
          ${this.showMobile ? `
            <div class="field">
              <label>${t.mobile}</label>
              <input name="mobile" type="tel" placeholder="${t.mobilePh}" />
            </div>
          ` : ''}
        </div>
        ${this.requireCode ? `
          <div class="field">
            <label>${t.code}</label>
            <div class="code-wrap">
              <input name="code" type="text" maxlength="5" autocomplete="off" spellcheck="false" placeholder="${this.codeExample}" />
              <span class="code-check">✓</span>
            </div>
            <div class="tip">💡&nbsp;${t.codeTip} ${this.codeExample}.</div>
            <span class="error" data-for="code"></span>
          </div>
        ` : ''}
        ${this.showSubject ? `
          <div class="field">
            <label>${t.subject}</label>
            <input name="subject" type="text" placeholder="${t.subjectPh}" />
          </div>
        ` : ''}
        ${this.extraFields.map((f) => {
          const key = `x-${f.name}`;
          const label = this.loc(f.label);
          const ph = this.loc(f.placeholder || '');
          let control;
          if (f.type === 'select') {
            control = `<select name="${key}">
              <option value="">${ph || '&mdash;'}</option>
              ${(f.options || []).map((o) => { const v = this.loc(o); return `<option value="${v}">${v}</option>`; }).join('')}
            </select>`;
          } else if (f.type === 'textarea') {
            control = `<textarea name="${key}" rows="3" placeholder="${ph}"></textarea>`;
          } else {
            control = `<input name="${key}" type="${f.type === 'tel' ? 'tel' : 'text'}" placeholder="${ph}" />`;
          }
          return `<div class="field"><label>${label}</label>${control}<span class="error" data-for="${key}"></span></div>`;
        }).join('')}
        <div class="field">
          <label>${t.message}</label>
          <textarea name="message" rows="4" placeholder="${t.messagePh}"></textarea>
          <span class="error" data-for="message"></span>
        </div>
        <div class="form-failed">${t.failed}</div>
        <button type="submit" class="submit">${t.send}</button>
      </form>

      <div class="form-sent">
        <h3>${t.sentTitle}</h3>
        <p>${t.sentBody}</p>
      </div>
    `;

    const root = this.shadowRoot;
    root.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });

    ['name', 'email', 'message'].forEach((name) => {
      const el = this.field(name);
      el?.addEventListener('blur', () => this.validate(name));
      el?.addEventListener('input', () => this.setError(name, ''));
    });

    this.extraFields.forEach((f) => {
      const key = `x-${f.name}`;
      const el = this.field(key);
      el?.addEventListener('input', () => this.setError(key, ''));
      el?.addEventListener('change', () => this.setError(key, ''));
      if (f.required) {
        el?.addEventListener('blur', () => {
          this.setError(key, (el.value || '').trim() ? '' : this.t.requiredErr);
        });
      }
    });

    if (this.requireCode) {
      const code = this.field('code');
      const tip = root.querySelector('.tip');
      code.addEventListener('input', () => {
        // live-format: uppercase, letters/digits only, max 5 chars
        const clean = code.value.toUpperCase().replace(/[^A-ZÆØÅ0-9]/g, '').slice(0, 5);
        if (clean !== code.value) code.value = clean;
        this.setError('code', '');
        const valid = this.codePattern.test(code.value);
        code.classList.toggle('valid', valid);
        tip.classList.toggle('show', !valid);
      });
      code.addEventListener('focus', () => {
        if (!this.codePattern.test(code.value)) tip.classList.add('show');
      });
      code.addEventListener('blur', () => {
        tip.classList.remove('show');
        this.validate('code');
      });
    }
  }
}

if (!customElements.get('dardanialabs-mailform')) {
  customElements.define('dardanialabs-mailform', DardaniaLabsMailform);
}

// legacy alias retained during dardanialabs migration
class LegacyDardaniaLabsMailform extends DardaniaLabsMailform {}
if (!customElements.get('rtek-mailform')) {
  customElements.define('rtek-mailform', LegacyDardaniaLabsMailform);
}
