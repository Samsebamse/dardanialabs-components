/**
 * dardanialabs-validators.js — validation source for the MAIL FORM only (the
 * dardanialabs-mailform web component + app-level contact/booking mail forms such
 * as digital_detox's BookPage). NOT used by other components (footer, photoslider).
 *
 * One JSON-shaped CONFIG. Each validator is SELF-CONTAINED under its own key —
 * its rule, regex and messages all live together:
 *
 *   SHARED: {
 *     <key>: {
 *       rule:    'required' | 'pattern' | …,
 *       pattern: '<regex>'                       // one regex for every language, OR
 *              | { no:'<regex>', en:'…', sq:'…' } // a per-language regex when the rule
 *                                                  //   is locale-specific (e.g. phone)
 *       message: { no:'…', en:'…', sq:'…' }       // the localized text/description
 *     }
 *   }
 *
 * `email` uses one regex for all languages; `phone` varies its regex per language
 * (country prefix + digit count). Add a language by adding its key to every
 * `pattern`/`message` object. A tenant-specific rule (e.g. digital_detox's booking
 * code) is NOT added here — that tenant defines it in its OWN app (three ways below).
 *
 * Usage:
 *   import { validate, validateAll, makeValidator, CONFIG } from './dardanialabs-validators.js';
 *   validate(form.email, 'email', lang);      // '' when valid, else localized message
 *   validate(form.phone, 'phone', lang);      // uses the language's own regex + message
 *   validateAll(form.email, ['required', 'email'], lang);
 *
 *   // A tenant's OWN unique rule, three ways:
 *   //  (1) bare function straight from the app — returns the message:
 *   validate(form.age, (v) => Number(v) >= 18 ? '' : 'Må være 18+', lang);
 *   //  (2) makeValidator() for a function WITH per-language messages:
 *   validate(form.vat, makeValidator(fn, { no:'…', en:'…', sq:'…' }), lang);
 *   //  (3) compose your OWN config and pass it in:  validate(v, 'code', lang, MY_CONFIG);
 */

export const CONFIG = {
	// Shared validators. Each key is self-contained: rule + regex + messages.
	SHARED: {
		required: {
			rule: 'required',
			message: { no: 'Dette feltet er påkrevd.', en: 'This field is required.', sq: 'Kjo fushë është e detyrueshme.' },
		},
		name: {
			rule: 'required',
			message: { no: 'Skriv inn navnet ditt.', en: 'Please enter your name.', sq: 'Ju lutem shkruani emrin tuaj.' },
		},
		email: {
			rule: 'pattern',
			pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', // same regex for every language
			message: { no: 'Skriv inn en gyldig e-postadresse.', en: 'Please enter a valid email address.', sq: 'Ju lutem shkruani një adresë email të vlefshme.' },
		},
		message: {
			rule: 'required',
			message: { no: 'Skriv en melding.', en: 'Please write a message.', sq: 'Ju lutem shkruani një mesazh.' },
		},
		phone: {
			rule: 'pattern',
			// locale-specific regex: prefix + digit count differ per country (empty allowed → optional)
			pattern: {
				no: '^(?:(?:\\+47[\\s]?)?\\d{8})?$', // Norway: +47 + 8 digits
				en: '^(?:\\+?\\d{7,15})?$', // generic international
				sq: '^(?:(?:\\+383|\\+355|0)?\\d{8,9})?$', // Kosovo/Albania: 8–9 digits
			},
			message: { no: 'Skriv inn et gyldig norsk telefonnummer (8 siffer).', en: 'Please enter a valid phone number.', sq: 'Ju lutem shkruani një numër telefoni valid.' },
		},
	},
};

export const LANGS = Object.keys(CONFIG.SHARED.email.message); // ['no', 'en', 'sq']
export const DEFAULT_LANG = 'no';

const trim = (v) => String(v ?? '').trim();
// pattern may be one string (all langs) or a per-language map — pick the right one
const patternFor = (def, lang) =>
	def.pattern && typeof def.pattern === 'object' ? def.pattern[lang] || def.pattern[DEFAULT_LANG] : def.pattern;
// message may be a plain string or a per-language map
const messageFor = (def, lang) => {
	const m = def.message || def.msg;
	return typeof m === 'string' ? m : (m && (m[lang] || m[DEFAULT_LANG])) || '';
};

// ── engine ── how each rule TYPE decides validity. Add types here as needs grow.
const RULES = {
	required: (value) => trim(value).length > 0,
	pattern: (value, def, lang) => new RegExp(patternFor(def, lang)).test(trim(value)),
	_fn: (value, def) => Boolean(def._test?.(value)), // makeValidator() escape hatch
};

/** Validate `value` against a SHARED key, a validator object, or a raw function.
 *  Returns the localized error message, or '' when valid. */
export const validate = (value, key, lang = DEFAULT_LANG, config = CONFIG) => {
	// A raw function IS the validator: the app supplies its own logic + message.
	if (typeof key === 'function') return key(value, lang) || '';
	const def = typeof key === 'object' && key ? key : config.SHARED[key];
	if (!def) return '';
	const rule = RULES[def.rule];
	if (!rule || rule(value, def, lang)) return ''; // valid (or unknown rule → don't block)
	return messageFor(def, lang);
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
