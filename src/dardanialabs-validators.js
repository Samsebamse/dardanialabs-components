/**
 * dardanialabs-validators.js — validation source for the MAIL FORM only (the
 * dardanialabs-mailform web component + app-level contact/booking mail forms such
 * as digital_detox's BookPage). NOT used by other components (footer, photoslider).
 *
 * Structure — the three outcomes each get their own clear home:
 *
 *   SHARED  → COMMON regexes, defined ONCE and used by every language (e.g. email).
 *   NO / EN / SQ → per-language blocks, each with:
 *       MESSAGES → the localized ERROR text for every validator key (shown on failure)
 *       REGEX    → regexes that are SPECIFIC to this language (e.g. phone: country
 *                  prefix + digit count). A language REGEX overrides SHARED for that key.
 *       HINT     → optional localized HELPER text guiding input (e.g. "e.g. +47 900 00 000").
 *                  Distinct from MESSAGES: a hint guides, a message reports a failure.
 *
 * Rule inference: if a key has a regex (its language REGEX, else SHARED) it is a
 * pattern check; if it has no regex it is a required (non-empty) check. Add a
 * language by adding a new top-level block. A tenant-specific rule (e.g.
 * digital_detox's booking code) is defined in THAT app, not here (three ways below).
 *
 * Usage:
 *   import { validate, validateAll, makeValidator, CONFIG } from './dardanialabs-validators.js';
 *   validate(form.email, 'email', lang);      // SHARED regex + this language's message
 *   validate(form.phone, 'phone', lang);      // this language's REGEX + message
 *   validate(form.name,  'name',  lang);      // no regex → required check
 *   validateAll(form.email, ['required', 'email'], lang);
 *
 *   // A tenant's OWN unique rule, three ways:
 *   //  (1) bare function from the app — returns the message:
 *   validate(form.age, (v) => Number(v) >= 18 ? '' : 'Må være 18+', lang);
 *   //  (2) makeValidator() for a function WITH per-language messages:
 *   validate(form.vat, makeValidator(fn, { no:'…', en:'…', sq:'…' }), lang);
 *   //  (3) compose your OWN config and pass it in:  validate(v, 'code', lang, MY_CONFIG);
 */

export const CONFIG = {
	// ── SHARED ── common regexes, defined once, used by every language.
	SHARED: {
		email: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
	},

	// ── NO ── Norsk
	NO: {
		MESSAGES: {
			required: 'Dette feltet er påkrevd.',
			name: 'Skriv inn navnet ditt.',
			email: 'Skriv inn en gyldig e-postadresse.',
			message: 'Skriv en melding.',
			phone: 'Skriv inn et gyldig norsk telefonnummer (8 siffer).',
		},
		REGEX: {
			phone: '^(?:(?:\\+47[\\s]?)?\\d{8})?$', // Norway: +47 + 8 digits (empty ok → optional)
		},
		HINT: {
			phone: 'F.eks. +47 900 00 000',
		},
	},

	// ── EN ── English
	EN: {
		MESSAGES: {
			required: 'This field is required.',
			name: 'Please enter your name.',
			email: 'Please enter a valid email address.',
			message: 'Please write a message.',
			phone: 'Please enter a valid phone number.',
		},
		REGEX: {
			phone: '^(?:\\+?\\d{7,15})?$', // generic international
		},
		HINT: {
			phone: 'e.g. +47 900 00 000',
		},
	},

	// ── SQ ── Shqip
	SQ: {
		MESSAGES: {
			required: 'Kjo fushë është e detyrueshme.',
			name: 'Ju lutem shkruani emrin tuaj.',
			email: 'Ju lutem shkruani një adresë email të vlefshme.',
			message: 'Ju lutem shkruani një mesazh.',
			phone: 'Ju lutem shkruani një numër telefoni valid.',
		},
		REGEX: {
			phone: '^(?:(?:\\+383|\\+355|0)?\\d{8,9})?$', // Kosovo/Albania: 8–9 digits
		},
		HINT: {
			phone: 'p.sh. +383 44 000 000',
		},
	},
};

export const LANGS = Object.keys(CONFIG).filter((k) => k !== 'SHARED').map((k) => k.toLowerCase());
export const DEFAULT_LANG = 'no';

const trim = (v) => String(v ?? '').trim();
const langBlock = (config, lang) => config[String(lang || DEFAULT_LANG).toUpperCase()] || config[DEFAULT_LANG.toUpperCase()];

/** Validate `value` against a predefined key, a validator object, or a raw function.
 *  Returns the localized error message, or '' when valid. */
export const validate = (value, key, lang = DEFAULT_LANG, config = CONFIG) => {
	// (a) raw function: the app supplies its own logic + returns the message.
	if (typeof key === 'function') return key(value, lang) || '';
	// (b) inline validator object (makeValidator): { _test, msg{no,en,sq} }.
	if (typeof key === 'object' && key) {
		if (key._test ? Boolean(key._test(value)) : true) return '';
		return (key.msg && (key.msg[lang] || key.msg[DEFAULT_LANG])) || '';
	}
	// (c) predefined key: language REGEX overrides SHARED; message from this language.
	const block = langBlock(config, lang);
	if (!block) return '';
	const regex = (block.REGEX && block.REGEX[key]) || (config.SHARED && config.SHARED[key]);
	const message = (block.MESSAGES && block.MESSAGES[key]) || '';
	const v = trim(value);
	if (regex) return new RegExp(regex).test(v) ? '' : message; // pattern rule
	return v.length > 0 ? '' : message; // no regex → required rule
};

/** The localized HELPER hint for a field ('' if none). Guides input; not an error. */
export const hint = (key, lang = DEFAULT_LANG, config = CONFIG) => {
	const block = langBlock(config, lang);
	return (block && block.HINT && block.HINT[key]) || '';
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
export const makeValidator = (test, msg) => ({ _test: test, msg });
