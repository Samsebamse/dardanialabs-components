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
    firstName: 'Fornavn', firstNamePh: 'Ditt fornavn',
    lastName: 'Etternavn', lastNamePh: 'Ditt etternavn',
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
    firstName: 'First name', firstNamePh: 'Your first name',
    lastName: 'Last name', lastNamePh: 'Your last name',
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
    firstName: 'Emri', firstNamePh: 'Emri juaj',
    lastName: 'Mbiemri', lastNamePh: 'Mbiemri juaj',
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

// The SAME rules the server gates on. dardanialabs-validators.js is the single
// source; the server keeps a vendored copy of this exact file for its own gate,
// so a field that passes here passes there. Before this, the form carried its
// own email regex and no phone rule at all, which is how a nine-digit Norwegian
// number reached the API and came back as an unexplained 400.
import { validate as validateValue } from './dardanialabs-validators.js';


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

  // Payload keys the form itself owns. A tenant field may not take one of these
  // names: silently overwriting the visitor's email address with a dropdown
  // value would be a far stranger bug than refusing the name.
  static RESERVED = new Set(['name', 'first_name', 'last_name', 'mobile', 'email', 'subject', 'message', 'lang', 'company']);

  // Payload key -> the input that shows its error. Only the keys whose two
  // names differ need an entry.
  static ERROR_FIELD = { first_name: 'firstName', last_name: 'lastName' };

  /**
   * The tenant's own fields as payload entries, keyed by the plain field name
   * the CMS stores in tenant_validators.field_key — `x-` is only how the input
   * is named inside the shadow DOM, and is not part of the contract.
   *
   * The code is included under its own key for the same reason: a tenant rule
   * on `code` has always been readable by the CMS but was never sent, so it
   * matched against nothing.
   */
  tenantFieldValues() {
    const values = {};
    if (this.requireCode) values.code = (this.field('code')?.value || '').trim();
    for (const f of this.extraFields) {
      if (DardaniaLabsMailform.RESERVED.has(f.name)) continue;
      values[f.name] = (this.field(`x-${f.name}`)?.value || '').trim();
    }
    return values;
  }

  setError(name, message) {
    const input = this.field(name);
    const error = this.shadowRoot.querySelector(`.error[data-for="${name}"]`);
    if (!input || !error) return !message;
    input.classList.toggle('invalid', Boolean(message));
    error.textContent = message || '';
    error.style.display = message ? 'block' : 'none';
    return !message;
  }

  // Is a validation message currently visible for this field? Used to drive
  // live re-validation: we only re-check WHILE typing if an error is already
  // showing, so a pristine field is never nagged before submit/blur.
  hasError(name) {
    const error = this.shadowRoot.querySelector(`.error[data-for="${name}"]`);
    return Boolean(error && error.textContent);
  }

  // The language the shared rules are keyed by. They carry no/en/sq; anything
  // else falls back rather than validating against rules that do not exist.
  get ruleLang() {
    return ['no', 'en', 'sq'].includes(this.lang) ? this.lang : 'no';
  }

  // Payload field -> the key its rule is filed under in the shared validators.
  // Every one of these is enforced by the server too, from a vendored copy of
  // that same file, so anything this lets through the server would refuse. The
  // form used to check only that name and message were non-empty while the
  // server demanded letters-only and at least ten characters — so "Firma 24"
  // and a four-word message passed here and came back as an unexplained 400.
  static SHARED_RULE = { firstName: 'firstName', lastName: 'lastName', email: 'email', mobile: 'phone', message: 'message' };

  validate(name) {
    const t = this.t;
    const value = (this.field(name)?.value || '').trim();

    // The code is the one field the shared rules do not own: its pattern is
    // configured per tenant on the element itself.
    if (name === 'code') return this.setError('code', this.codePattern.test(value) ? '' : t.codeErr);

    const rule = DardaniaLabsMailform.SHARED_RULE[name];
    if (!rule) return true;
    // An empty required field gets the form's own wording — the shared rule
    // would answer with its format message, which is not what "you left this
    // blank" should say. mobile is exempt: blank IS valid there.
    if (!value && name !== 'mobile') {
      return this.setError(name, t[`${name}Err`] || t.requiredErr);
    }
    return this.setError(name, validateValue(value, rule, this.ruleLang) || '');
  }

  /**
   * Live validation, the eager version.
   *
   * A field is checked on every keystroke, but a BLANK field never shows a
   * message: someone who has not finished typing has not made a mistake yet.
   * Leaving a field re-checks it, so tabbing past a half-finished number does
   * report. Together that means the visitor is told the moment the value is
   * wrong and never before, and an invalid form cannot reach the API at all.
   */
  watchField(name) {
    const el = this.field(name);
    if (!el) return;
    el.addEventListener('input', () => {
      if ((el.value || '').trim() === '') this.setError(name, '');
      else this.validate(name);
    });
    el.addEventListener('blur', () => {
      if ((el.value || '').trim() === '') this.setError(name, '');
      else this.validate(name);
    });
  }

  // Long enough to be read without hurrying, short enough that someone who
  // meant to send a second message is not left waiting on a page they cannot
  // use. Cleared on disconnect so a torn-down element cannot fire into nothing.
  restoreAfterSent() {
    clearTimeout(this._sentTimer);
    this._sentTimer = setTimeout(() => {
      const root = this.shadowRoot;
      if (!root) return;
      const form = root.querySelector('form');
      const sent = root.querySelector('.form-sent');
      if (!form || !sent) return;
      form.reset();
      // reset() restores the values, not the verdicts — a message left over
      // from the previous send would greet the next one.
      root.querySelectorAll('.error').forEach((el) => { el.textContent = ''; el.style.display = 'none'; });
      root.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
      sent.style.display = 'none';
      form.style.display = '';
    }, 7000);
  }

  disconnectedCallback() {
    clearTimeout(this._sentTimer);
  }

  async submit() {
    if (this.busy) return;
    // mobile is in the list although it is optional: the rule accepts an empty
    // value, so including it costs nothing and catches a filled-in bad number.
    const required = ['firstName', 'lastName', 'email', 'mobile', ...(this.requireCode ? ['code'] : []), 'message'];
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
        // Both halves, plus the composed line. The parts are what validates
        // and what anything downstream should read; `name` stays so the mail
        // templates, the stored enquiry and every existing consumer keep
        // working unchanged during and after the rollout.
        first_name: this.field('firstName').value.trim(),
        last_name: this.field('lastName').value.trim(),
        name: `${this.field('firstName').value.trim()} ${this.field('lastName').value.trim()}`.trim(),
        mobile: this.showMobile ? (this.field('mobile')?.value.trim() || '') : '',
        email: this.field('email').value.trim(),
        subject: (this.showSubject && this.field('subject')?.value.trim())
          || extraSubject
          || t.subjectDefault,
        message,
        lang: this.lang,
        company: this.field('company')?.value || '',
        // The tenant's own fields, sent AS FIELDS and not only folded into the
        // message body above. tenant_validators is the override layer — the
        // server looks each rule up by field_key and reads data[field_key] — so
        // while these travelled only inside the message text, a tenant's
        // "required" rule read undefined and refused every submit, and a
        // "pattern" rule quietly passed anything at all. They stay in the
        // message too: that is what a human reads in the enquiry.
        ...this.tenantFieldValues(),
      },
    };

    try {
      const response = await fetch(`${this.api}/mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // A 400 from the mail gate is not a mystery: the body names each field it
      // refused and why, in the visitor's language. Throwing that away and
      // showing one red box was how a nine-digit phone number became "something
      // went wrong". Client validation should mean this never fires — but the
      // server has rules of its own (per-tenant validators), so when it does
      // refuse, the visitor is shown exactly which field and told nothing vague.
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const fieldErrors = body && typeof body.errors === 'object' ? body.errors : null;
        if (fieldErrors && Object.keys(fieldErrors).length) {
          let firstRejected = null;
          for (const [field, message] of Object.entries(fieldErrors)) {
            // The server answers with the key it received — first_name — while
            // the input is called firstName. Without this the lookup missed, fell
            // through to x-first_name, missed again, and setError quietly did
            // nothing: a refusal with no message anywhere and a dead button.
            const named = DardaniaLabsMailform.ERROR_FIELD[field] || field;
            const key = this.field(named) ? named : `x-${named}`;
            this.setError(key, String(message));
            if (!firstRejected) firstRejected = key;
          }
          const el = this.field(firstRejected);
          el?.focus?.();
          el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          return; // a refused field is not a failed send: no red banner
        }
        throw new Error(`Mail request failed (${response.status})`);
      }
      this.shadowRoot.querySelector('form').style.display = 'none';
      this.shadowRoot.querySelector('.form-sent').style.display = 'block';
      // The confirmation used to be the last thing that ever happened here: the
      // form was hidden and stayed hidden, so a visitor who thought of one more
      // question had to reload the page to ask it. It steps aside on its own
      // and hands back an empty form.
      this.restoreAfterSent();
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
        /* font-style is stated rather than inherited: a shadow root still takes
           it from the host, and on a page whose section is set in italics the
           confirmation arrived leaning over like an afterthought. */
        .form-sent h3 {
          margin: 0 0 0.5rem;
          font-style: normal;
          color: var(--dardanialabs-text, var(--rtek-text, #2c2c2c));
        }
        .form-sent p {
          margin: 0;
          font-style: normal;
          color: var(--dardanialabs-text, var(--rtek-text, #2c2c2c));
          opacity: 0.75;
        }
        /* The success colour marks the tick, not the sentence. A whole heading
           in it reads as a status badge rather than as the site talking. */
        .form-sent .sent-mark {
          display: block;
          width: 44px;
          height: 44px;
          margin: 0 auto 1rem;
          color: var(--dardanialabs-success, var(--rtek-success, #3d5142));
        }
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
        <!-- Honeypot: absolutely positioned off-canvas rather than
             display:none, because cruder bots skip hidden fields but still
             autofill off-screen ones. No human ever sees or fills it; the
             server answers a filled one with a fake success and sends
             nothing. aria-hidden + tabindex keep it out of screen readers
             and tab order. -->
        <div style="position:absolute;left:-9999px;top:-9999px;height:1px;width:1px;overflow:hidden;" aria-hidden="true">
          <input name="company" type="text" tabindex="-1" autocomplete="off" />
        </div>
        <!-- Two fields, not one. Asking separately is the only way to say WHICH
             half is wrong, and it matches the booking form, which has always
             needed the parts apart because a booking name must match a passport. -->
        <div class="row">
          <div class="field">
            <label>${t.firstName}</label>
            <input name="firstName" type="text" autocomplete="given-name" placeholder="${t.firstNamePh}" />
            <span class="error" data-for="firstName"></span>
          </div>
          <div class="field">
            <label>${t.lastName}</label>
            <input name="lastName" type="text" autocomplete="family-name" placeholder="${t.lastNamePh}" />
            <span class="error" data-for="lastName"></span>
          </div>
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
              <span class="error" data-for="mobile"></span>
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
        <svg class="sent-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="8 12.5 11 15.5 16 9.5" />
        </svg>
        <h3>${t.sentTitle}</h3>
        <p>${t.sentBody}</p>
      </div>
    `;

    const root = this.shadowRoot;
    root.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });

    // Every field the shared rules cover, checked as it is typed — mobile
    // included, which is the one that used to reach the server unchecked.
    ['firstName', 'lastName', 'email', 'mobile', 'message'].forEach((name) => this.watchField(name));

    // Tenant custom fields follow the SAME rule as the built-in ones: checked as
    // they change, silent while blank, re-checked on the way out. They used to
    // clear unconditionally on blur, so a required field left empty went quiet
    // the moment you tabbed past it — and extras are folded into the message
    // body, so the server never catches them either.
    this.extraFields.forEach((f) => {
      const key = `x-${f.name}`;
      const el = this.field(key);
      if (!el) return;
      const check = () => {
        const filled = Boolean((el.value || '').trim());
        if (!filled && !f.required) return this.setError(key, '');
        this.setError(key, filled ? '' : this.t.requiredErr);
      };
      el.addEventListener('input', check);
      el.addEventListener('change', check);
      el.addEventListener('blur', check);
    });

    if (this.requireCode) {
      const code = this.field('code');
      const tip = root.querySelector('.tip');
      code.addEventListener('input', () => {
        // live-format: uppercase, letters/digits only, max 5 chars
        const clean = code.value.toUpperCase().replace(/[^A-ZÆØÅ0-9]/g, '').slice(0, 5);
        if (clean !== code.value) code.value = clean;
        const valid = this.codePattern.test(code.value);
        code.classList.toggle('valid', valid);
        tip.classList.toggle('show', !valid);
        if (this.hasError('code')) this.validate('code'); // live-clear once valid
      });
      code.addEventListener('focus', () => {
        if (!this.codePattern.test(code.value)) tip.classList.add('show');
      });
      code.addEventListener('blur', () => {
        tip.classList.remove('show');
        // Re-check rather than clear, like every other field: a half-typed code
        // left behind should say so instead of going quiet on the way out.
        if ((code.value || '').trim() === '') this.setError('code', '');
        else this.validate('code');
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
