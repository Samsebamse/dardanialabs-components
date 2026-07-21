/**
 * dardanialabs-validators.js — validation source for the MAIL FORM only (the
 * dardanialabs-mailform web component + app-level contact/booking mail forms such
 * as digital_detox's BookPage). It is NOT used by other components (footer,
 * photoslider) — it is purely the mail form's shared, DATA-DRIVEN validation.
 *
 * Everything predefined lives in the JSON-shaped CONFIG object below, split into
 * clear sections:
 *
 *   shared    → validators every tenant can use by key   (email, required, name, message)
 *   extras    → rules reused across MULTIPLE tenants (empty for now). A rule for ONE
 *               tenant (e.g. digital_detox's booking code) is defined in THAT app, not here.
 *   patterns  → named regexes the rules point at
 *   messages  → language-specific text  (no / en / sq) — add a language by adding a key
 *
 * A validator is pure data: { rule, pattern?, message }. The tiny engine at the
 * bottom applies it. Framework-agnostic (no Vue / no custom-element code) so the
 * web components AND the Vue/React sites all draw from the exact same rules + text.
 *
 * Usage:
 *   import { validate, validateAll, makeValidator, CONFIG } from './dardanialabs-validators.js';
 *   validate(form.email, 'email', lang);              // '' when valid, else localized message
 *   validateAll(form.email, ['required', 'email'], lang);
 *
 *   // A tenant's OWN unique rule, three equally valid ways:
 *   //  (1) send a bare function straight from your app — it returns the message:
 *   validate(form.age, (v) => Number(v) >= 18 ? '' : 'Må være 18+', lang);
 *   //  (2) makeValidator() if you want per-language messages on that function:
 *   const vat = makeValidator(v => isValidVat(v), { no:'…', en:'…', sq:'…' });
 *   validate(form.vat, vat, lang);
 *   //  (3) add a reusable declarative rule to CONFIG.extras + CONFIG.patterns.
 */

export const CONFIG = {
	// ── shared ── validators every tenant can use straight away, by key
	shared: {
		required: { rule: 'required', message: 'required' },
		name: { rule: 'required', message: 'name' },
		email: { rule: 'pattern', pattern: 'email', message: 'email' },
		message: { rule: 'required', message: 'message' },
	},

	// ── extras ── reusable rules shared by MULTIPLE tenants go here. A rule that is
	// specific to ONE tenant (e.g. digital_detox's booking code) does NOT belong in
	// this shared list — that tenant defines it in its OWN app with a custom
	// function / makeValidator(). Empty for now on purpose.
	extras: {},

	// ── patterns ── named regexes the rules above reference (strings, so this stays JSON)
	patterns: {
		email: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
	},

	// ── messages ── language-specific text; message keys are shared across languages
	messages: {
		no: {
			required: 'Dette feltet er påkrevd.',
			name: 'Skriv inn navnet ditt.',
			email: 'Skriv inn en gyldig e-postadresse.',
			message: 'Skriv en melding.',
		},
		en: {
			required: 'This field is required.',
			name: 'Please enter your name.',
			email: 'Please enter a valid email address.',
			message: 'Please write a message.',
		},
		sq: {
			required: 'Kjo fushë është e detyrueshme.',
			name: 'Ju lutem shkruani emrin tuaj.',
			email: 'Ju lutem shkruani një adresë email të vlefshme.',
			message: 'Ju lutem shkruani një mesazh.',
		},
	},
};

export const LANGS = Object.keys(CONFIG.messages); // ['no', 'en', 'sq']
export const DEFAULT_LANG = 'no';

const trim = (v) => String(v ?? '').trim();

// ── engine ── how each rule TYPE decides validity. Add types here as needs grow.
const RULES = {
	required: (value) => trim(value).length > 0,
	pattern: (value, def, patterns) => new RegExp(patterns[def.pattern]).test(trim(value)),
	_fn: (value, def) => Boolean(def._test?.(value)), // makeValidator() escape hatch
};

const lookup = (key, config) => config.shared[key] || config.extras[key];

/** Validate `value` against a predefined key (shared/extras) or a validator object.
 *  Returns the localized error message, or '' when valid. */
export const validate = (value, key, lang = DEFAULT_LANG, config = CONFIG) => {
	// A raw function IS the validator: the app supplies its own logic and returns
	// the error message directly ('' when valid). The most direct way to add a one-off.
	if (typeof key === 'function') return key(value, lang) || '';
	const def = typeof key === 'object' && key ? key : lookup(key, config);
	if (!def) return '';
	const rule = RULES[def.rule];
	if (rule && rule(value, def, config.patterns)) return '';
	if (!rule) return ''; // unknown rule type → treat as pass rather than block
	// inline validators carry their own msg; keyed ones look up the message catalog
	const cat = config.messages[lang] || config.messages[DEFAULT_LANG];
	return (def.msg && (def.msg[lang] || def.msg[DEFAULT_LANG])) || (cat && cat[def.message]) || '';
};

/** First failing rule among a list (keys or validator objects). '' if all pass. */
export const validateAll = (value, keys, lang = DEFAULT_LANG, config = CONFIG) => {
	for (const key of keys || []) {
		const err = validate(value, key, lang, config);
		if (err) return err;
	}
	return '';
};

/** Inline custom validator with its own per-language messages (exotic logic). */
export const makeValidator = (test, msg) => ({ rule: '_fn', _test: test, msg });
