/**
 * dardanialabs-validators.js — validation source for the MAIL FORM only (the
 * dardanialabs-mailform web component + app-level contact/booking mail forms such
 * as digital_detox's BookPage). NOT used by other components (footer, photoslider).
 *
 * One JSON-shaped CONFIG object with flat top-level keys:
 *
 *   SHARED → validators whose rule is the SAME in every language (email, required,
 *            name, message). Rule + regex live here; each language only supplies text.
 *   NO / EN / SQ → per-language catalogs. An entry is either:
 *              • a STRING  → the message for a SHARED validator of that key, OR
 *              • an OBJECT  → a LANGUAGE-SPECIFIC validator { rule, pattern, message }
 *                for rules that genuinely differ per locale — e.g. a phone number's
 *                country prefix and digit count. The rule lives IN the language.
 *            Add a language by adding a new top-level catalog (e.g. DE) + entries.
 *
 * A tenant-specific rule (e.g. digital_detox's booking code) is NOT added here —
 * that tenant defines it in its OWN app (see the three ways below).
 *
 * Usage:
 *   import { validate, validateAll, makeValidator, CONFIG } from './dardanialabs-validators.js';
 *   validate(form.email, 'email', lang);      // SHARED rule + localized message
 *   validate(form.phone, 'phone', lang);      // language-specific rule + message
 *   validateAll(form.email, ['required', 'email'], lang);
 *
 *   // A tenant's OWN unique rule, three ways:
 *   //  (1) bare function straight from the app — returns the message:
 *   validate(form.age, (v) => Number(v) >= 18 ? '' : 'Må være 18+', lang);
 *   //  (2) makeValidator() for a function WITH per-language messages:
 *   validate(form.vat, makeValidator(fn, { no:'…', en:'…', sq:'…' }), lang);
 *   //  (3) compose your OWN config (SHARED + language catalogs) and pass it in:
 *   validate(form.code, 'code', lang, MY_APP_CONFIG);
 */

export const CONFIG = {
	// ── SHARED ── validators whose rule/regex is identical in every language.
	SHARED: {
		required: { rule: 'required' },
		name: { rule: 'required' },
		email: { rule: 'pattern', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
		message: { rule: 'required' },
	},

	// ── NO ── Norsk. Strings = messages for SHARED rules; objects = NO-specific rules.
	NO: {
		required: 'Dette feltet er påkrevd.',
		name: 'Skriv inn navnet ditt.',
		email: 'Skriv inn en gyldig e-postadresse.',
		message: 'Skriv en melding.',
		// Norwegian phone: 8 digits, optional +47 prefix (empty allowed → optional field)
		phone: {
			rule: 'pattern',
			pattern: '^(?:(?:\\+47[\\s]?)?\\d{8})?$',
			message: 'Skriv inn et gyldig norsk telefonnummer (8 siffer).',
		},
	},

	// ── EN ── English. Generic international phone format.
	EN: {
		required: 'This field is required.',
		name: 'Please enter your name.',
		email: 'Please enter a valid email address.',
		message: 'Please write a message.',
		phone: {
			rule: 'pattern',
			pattern: '^(?:\\+?\\d{7,15})?$',
			message: 'Please enter a valid phone number.',
		},
	},

	// ── SQ ── Shqip. Kosovo (+383) / Albania (+355), 8–9 digits.
	SQ: {
		required: 'Kjo fushë është e detyrueshme.',
		name: 'Ju lutem shkruani emrin tuaj.',
		email: 'Ju lutem shkruani një adresë email të vlefshme.',
		message: 'Ju lutem shkruani një mesazh.',
		phone: {
			rule: 'pattern',
			pattern: '^(?:(?:\\+383|\\+355|0)?\\d{8,9})?$',
			message: 'Ju lutem shkruani një numër telefoni valid.',
		},
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

// Run a validator definition; return its message when it FAILS, else ''.
const run = (value, def, lang, messageFallback) => {
	const rule = RULES[def.rule];
	if (!rule || rule(value, def)) return ''; // valid (or unknown rule → don't block)
	if (def.msg) return def.msg[lang] || def.msg[DEFAULT_LANG] || ''; // inline per-lang msgs
	return def.message || messageFallback || ''; // language-specific msg, or SHARED's catalog string
};

/** Validate `value` against a SHARED key, a language-specific key, a validator
 *  object, or a raw function. Returns the localized error message, or '' when valid. */
export const validate = (value, key, lang = DEFAULT_LANG, config = CONFIG) => {
	// (a) raw function: the app supplies its own logic and returns the message.
	if (typeof key === 'function') return key(value, lang) || '';
	// (b) inline validator object (e.g. makeValidator) — carries its own rule + msg.
	if (typeof key === 'object' && key) return run(value, key, lang);
	// (c) named validator. A language-specific rule (object in the catalog) wins;
	//     otherwise a SHARED rule with its string message from the language catalog.
	const messages = catalog(config, lang);
	const local = messages ? messages[key] : undefined;
	if (local && typeof local === 'object') return run(value, local, lang); // language-specific
	const def = config.SHARED[key];
	if (!def) return '';
	return run(value, def, lang, typeof local === 'string' ? local : '');
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
