/**
 * dardanialabs-validators.js — validation source for the MAIL FORM only (the
 * dardanialabs-mailform web component + app-level contact/booking mail forms such
 * as digital_detox's BookPage). NOT used by other components (footer, photoslider).
 *
 * Structure — the three outcomes each get their own clear home:
 *
 *   SHARED  → COMMON regexes, defined ONCE and used by every language (e.g. email).
 *   NO / EN / SQ → per-language blocks, each with:
 *       HINT   → the localized text stating what's required for each key. It's the
 *                one text per field: shown as the failure feedback, and a form may
 *                also show it as guiding helper text.
 *       REGEX  → regexes SPECIFIC to this language (e.g. phone: country prefix +
 *                digit count). A language REGEX overrides SHARED for that key.
 *
 * Rule inference: if a key has a regex (its language REGEX, else SHARED) it is a
 * pattern check; if it has no regex it is a required (non-empty) check. Add a
 * language by adding a new top-level block. A tenant-specific rule (e.g.
 * digital_detox's booking code) is defined in THAT app, not here (three ways below).
 *
 * Usage:
 *   import { validate, hint, validateAll, makeValidator, CONFIG } from './dardanialabs-validators.js';
 *   validate(form.email, 'email', lang);      // SHARED regex + this language's HINT on failure
 *   validate(form.phone, 'phone', lang);      // this language's REGEX + HINT
 *   hint('phone', lang);                       // the HINT text on its own (helper text)
 *   validateAll(form.email, ['required', 'email'], lang);
 *
 *   // A tenant's OWN unique rule, three ways:
 *   //  (1) bare function from the app — returns the message:
 *   validate(form.age, (v) => Number(v) >= 18 ? '' : 'Må være 18+', lang);
 *   //  (2) makeValidator() for a function WITH per-language text:
 *   validate(form.vat, makeValidator(fn, { no:'…', en:'…', sq:'…' }), lang);
 *   //  (3) compose your OWN config and pass it in:  validate(v, 'code', lang, MY_CONFIG);
 */

export const CONFIG = {
	// ── SHARED ── common regexes, defined once, used by every language.
	SHARED: {
		// name: at least 2 letters (so "Jo" is valid); letters + spaces/'/-/. between.
		name: '^\\p{L}[\\p{L}\\s\'.-]*\\p{L}$',
		// email: local ≥2, domain label ≥2, a dot, then a TLD of ≥2 letters.
		email: '^[^\\s@]{2,}@[^\\s@]{2,}\\.[A-Za-z]{2,}$',
	},

	// ── NO ── Norsk
	NO: {
		HINT: {
			required: 'Dette feltet er påkrevd.',
			name: 'Navnet må ha minst 2 bokstaver.',
			email: 'Skriv inn en gyldig e-postadresse.',
			message: 'Skriv en melding.',
			phone: 'Gyldig norsk telefonnummer – 8 siffer (f.eks. +47 900 00 000).',
		},
		REGEX: {
			phone: '^(?:(?:\\+47[\\s]?)?\\d{8})?$', // Norway: +47 + 8 digits (empty ok → optional)
		},
	},

	// ── EN ── English
	EN: {
		HINT: {
			required: 'This field is required.',
			name: 'Your name must be at least 2 letters.',
			email: 'Please enter a valid email address.',
			message: 'Please write a message.',
			phone: 'A valid phone number (e.g. +47 900 00 000).',
		},
		REGEX: {
			phone: '^(?:\\+?\\d{7,15})?$', // generic international
		},
	},

	// ── SQ ── Shqip
	SQ: {
		HINT: {
			required: 'Kjo fushë është e detyrueshme.',
			name: 'Emri duhet të ketë të paktën 2 shkronja.',
			email: 'Ju lutem shkruani një adresë email të vlefshme.',
			message: 'Ju lutem shkruani një mesazh.',
			phone: 'Numër telefoni valid – 8–9 shifra (p.sh. +383 44 000 000).',
		},
		REGEX: {
			phone: '^(?:(?:\\+383|\\+355|0)?\\d{8,9})?$', // Kosovo/Albania: 8–9 digits
		},
	},
};

export const LANGS = Object.keys(CONFIG).filter((k) => k !== 'SHARED').map((k) => k.toLowerCase());
export const DEFAULT_LANG = 'no';

const trim = (v) => String(v ?? '').trim();
const langBlock = (config, lang) => config[String(lang || DEFAULT_LANG).toUpperCase()] || config[DEFAULT_LANG.toUpperCase()];

/** The localized HINT for a field ('' if none) — states what's required. */
export const hint = (key, lang = DEFAULT_LANG, config = CONFIG) => {
	const block = langBlock(config, lang);
	return (block && block.HINT && block.HINT[key]) || '';
};

/** Validate `value` against a predefined key, a validator object, or a raw function.
 *  Returns the localized HINT (error) text, or '' when valid. */
export const validate = (value, key, lang = DEFAULT_LANG, config = CONFIG) => {
	// (a) raw function: the app supplies its own logic + returns the message.
	if (typeof key === 'function') return key(value, lang) || '';
	// (b) inline validator object (makeValidator): { _test, hint{no,en,sq} }.
	if (typeof key === 'object' && key) {
		if (key._test ? Boolean(key._test(value)) : true) return '';
		return (key.hint && (key.hint[lang] || key.hint[DEFAULT_LANG])) || '';
	}
	// (c) predefined key: language REGEX overrides SHARED; text from this language's HINT.
	const block = langBlock(config, lang);
	if (!block) return '';
	const regex = (block.REGEX && block.REGEX[key]) || (config.SHARED && config.SHARED[key]);
	const text = (block.HINT && block.HINT[key]) || '';
	const v = trim(value);
	if (regex) return new RegExp(regex, 'u').test(v) ? '' : text; // pattern rule ('u' → \p{L} etc.)
	return v.length > 0 ? '' : text; // no regex → required rule
};

/** First failing rule among a list (keys or validator objects/functions). '' if all pass. */
export const validateAll = (value, keys, lang = DEFAULT_LANG, config = CONFIG) => {
	for (const key of keys || []) {
		const err = validate(value, key, lang, config);
		if (err) return err;
	}
	return '';
};

/** Inline custom validator with its own per-language HINT text (exotic logic). */
export const makeValidator = (test, hint) => ({ _test: test, hint });
