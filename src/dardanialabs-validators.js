/**
 * dardanialabs-validators.js — validation source for the MAIL FORM only (the
 * dardanialabs-mailform web component + app-level contact/booking mail forms such
 * as digital_detox's BookPage). NOT used by other components (footer, photoslider).
 *
 * The predefined data is one JSON-shaped CONFIG object with flat top-level keys:
 *
 *   SHARED → the validators every mail form uses. Each element carries its rule
 *            (+ regex pattern where relevant). Rule/regex is language-independent.
 *   NO / EN / SQ → the message text for each element, one catalog per language.
 *            The element key (e.g. "email") is the same across SHARED and every
 *            language, so a validator and its messages line up by key. Add a
 *            language by adding a new top-level catalog (e.g. DE) + entries.
 *
 * A tenant-specific rule (e.g. digital_detox's booking code) is NOT added here —
 * that tenant defines it in its OWN app (see the three ways below).
 *
 * Usage:
 *   import { validate, validateAll, makeValidator, CONFIG } from './dardanialabs-validators.js';
 *   validate(form.email, 'email', lang);              // '' when valid, else localized message
 *   validateAll(form.email, ['required', 'email'], lang);
 *
 *   // A tenant's OWN unique rule, three ways:
 *   //  (1) bare function straight from the app — returns the message:
 *   validate(form.age, (v) => Number(v) >= 18 ? '' : 'Må være 18+', lang);
 *   //  (2) makeValidator() for a function WITH per-language messages:
 *   const vat = makeValidator(v => isValidVat(v), { no:'…', en:'…', sq:'…' });
 *   validate(form.vat, vat, lang);
 *   //  (3) compose your OWN config (SHARED + language catalogs) and pass it in:
 *   validate(form.code, 'code', lang, MY_APP_CONFIG);
 */

export const CONFIG = {
	// ── SHARED ── the validators; each element has its rule (+ regex where needed).
	SHARED: {
		required: { rule: 'required' },
		name: { rule: 'required' },
		email: { rule: 'pattern', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
		message: { rule: 'required' },
	},

	// ── NO ── Norsk messages, keyed by element name
	NO: {
		required: 'Dette feltet er påkrevd.',
		name: 'Skriv inn navnet ditt.',
		email: 'Skriv inn en gyldig e-postadresse.',
		message: 'Skriv en melding.',
	},

	// ── EN ── English messages
	EN: {
		required: 'This field is required.',
		name: 'Please enter your name.',
		email: 'Please enter a valid email address.',
		message: 'Please write a message.',
	},

	// ── SQ ── Shqip messages
	SQ: {
		required: 'Kjo fushë është e detyrueshme.',
		name: 'Ju lutem shkruani emrin tuaj.',
		email: 'Ju lutem shkruani një adresë email të vlefshme.',
		message: 'Ju lutem shkruani një mesazh.',
	},
};

export const LANGS = Object.keys(CONFIG).filter((k) => k !== 'SHARED').map((k) => k.toLowerCase());
export const DEFAULT_LANG = 'no';

const trim = (v) => String(v ?? '').trim();
// pick a language catalog (case-insensitive lang), falling back to the default
const catalog = (config, lang) =>
	config[String(lang || DEFAULT_LANG).toUpperCase()] || config[DEFAULT_LANG.toUpperCase()];

// ── engine ── how each rule TYPE decides validity. Add types here as needs grow.
const RULES = {
	required: (value) => trim(value).length > 0,
	pattern: (value, def) => new RegExp(def.pattern).test(trim(value)),
	_fn: (value, def) => Boolean(def._test?.(value)), // makeValidator() escape hatch
};

/** Validate `value` against a predefined SHARED key, a validator object, or a raw
 *  function. Returns the localized error message, or '' when valid. */
export const validate = (value, key, lang = DEFAULT_LANG, config = CONFIG) => {
	// A raw function IS the validator: the app supplies its own logic and returns
	// the error message directly ('' when valid). The most direct one-off.
	if (typeof key === 'function') return key(value, lang) || '';
	const def = typeof key === 'object' && key ? key : config.SHARED[key];
	if (!def) return '';
	const rule = RULES[def.rule];
	if (!rule || rule(value, def)) return ''; // valid (or unknown rule → don't block)
	// inline validators carry their own msg; keyed ones look up the language catalog by key
	if (def.msg) return def.msg[lang] || def.msg[DEFAULT_LANG] || '';
	const messages = catalog(config, lang);
	return (messages && messages[key]) || '';
};

/** First failing rule among a list (keys or validator objects/functions). '' if all pass. */
export const validateAll = (value, keys, lang = DEFAULT_LANG, config = CONFIG) => {
	for (const key of keys || []) {
		const err = validate(value, key, lang, config);
		if (err) return err;
	}
	return '';
};

/** Inline custom validator with its own per-language messages (exotic logic). */
export const makeValidator = (test, msg) => ({ rule: '_fn', _test: test, msg });
