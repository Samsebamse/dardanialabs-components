/**
 * dardanialabs-validators.js — ONE shared front-end validation source for every
 * DardaniaLabs tenant. Framework-agnostic on purpose (no Vue, no custom-element
 * code), so the web components AND the Vue/React sites can all draw from the same
 * rules and the same localized messages.
 *
 * Languages supported so far: no (Norsk), en (English), sq (Shqip). Add a new
 * language by adding its key to every `msg` object below.
 *
 * Shape of a validator:  { test(value) -> boolean, msg: { no, en, sq } }
 *
 * Usage:
 *   import { SHARED, EXTRAS, validate, validateAll, makeValidator } from './dardanialabs-validators.js';
 *   validate(form.email, 'email', lang);           // '' when valid, else localized message
 *   validate(form.name,  'required', lang);
 *   validateAll(form.email, ['required', 'email'], lang);   // first failing rule wins
 *
 *   // a tenant's OWN unique rule (e.g. digital_detox's booking code):
 *   const code = makeValidator(
 *     (v) => /^[A-ZÆØÅ]{3}[0-9]{2}$/.test(String(v).trim()),
 *     { no: 'Koden må være …', en: 'The code must be …', sq: 'Kodi duhet …' },
 *   );
 *   validate(form.code, code, lang);
 */

// Languages we support so far. Extend this (and every msg object) to add more.
export const LANGS = ['no', 'en', 'sq'];
export const DEFAULT_LANG = 'no';

const trim = (v) => String(v ?? '').trim();
const notEmpty = (v) => trim(v).length > 0;

// Reusable regexes so tenants can compose against the same patterns.
export const PATTERNS = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	code: /^[A-ZÆØÅ]{3}[0-9]{2}$/, // 3 letters + 2 digits, e.g. ABC12
};

/**
 * SHARED — the common validators every tenant can use straight away, by key.
 * `email` (and the rest) live here so all tenants take advantage of one definition.
 */
export const SHARED = {
	required: {
		test: notEmpty,
		msg: {
			no: 'Dette feltet er påkrevd.',
			en: 'This field is required.',
			sq: 'Kjo fushë është e detyrueshme.',
		},
	},
	name: {
		test: notEmpty,
		msg: {
			no: 'Skriv inn navnet ditt.',
			en: 'Please enter your name.',
			sq: 'Ju lutem shkruani emrin tuaj.',
		},
	},
	email: {
		test: (v) => PATTERNS.email.test(trim(v)),
		msg: {
			no: 'Skriv inn en gyldig e-postadresse.',
			en: 'Please enter a valid email address.',
			sq: 'Ju lutem shkruani një adresë email të vlefshme.',
		},
	},
	message: {
		test: notEmpty,
		msg: {
			no: 'Skriv en melding.',
			en: 'Please write a message.',
			sq: 'Ju lutem shkruani një mesazh.',
		},
	},
};

/**
 * EXTRAS — ready-made but OPT-IN validators. Not every tenant needs these, but
 * when one does it should reuse the shared definition rather than re-writing it.
 * `code` is digital_detox's booking code. Add new reusable rules here, or build a
 * one-off inline with makeValidator().
 */
export const EXTRAS = {
	code: {
		test: (v) => PATTERNS.code.test(trim(v)),
		msg: {
			no: 'Koden må være 3 bokstaver etterfulgt av 2 siffer – 5 tegn totalt.',
			en: 'The code must be 3 letters followed by 2 digits — 5 characters in total.',
			sq: 'Kodi duhet të ketë 3 shkronja të ndjekura nga 2 shifra — gjithsej 5 karaktere.',
		},
	},
};

/** Build a custom validator with messages in all languages. */
export const makeValidator = (test, msg) => ({ test, msg });

/** Build a pattern-based validator quickly (custom regex + messages). */
export const pattern = (re, msg) => ({ test: (v) => re.test(trim(v)), msg });

/** Resolve a validator from a SHARED/EXTRAS key, or pass an object through. */
const resolve = (validator) =>
	typeof validator === 'string' ? SHARED[validator] || EXTRAS[validator] : validator;

/**
 * Validate a value against a single validator (a SHARED/EXTRAS key or an object).
 * Returns the localized error message, or '' when the value is valid.
 */
export const validate = (value, validator, lang = DEFAULT_LANG) => {
	const v = resolve(validator);
	if (!v || typeof v.test !== 'function') return '';
	if (v.test(value)) return '';
	return (v.msg && (v.msg[lang] || v.msg[DEFAULT_LANG])) || '';
};

/**
 * Validate a value against a LIST of validators, returning the first failure
 * (or '' if all pass). Rules may be keys or validator objects, mixed freely:
 *   validateAll(email, ['required', 'email'], lang)
 */
export const validateAll = (value, validators, lang = DEFAULT_LANG) => {
	for (const rule of validators || []) {
		const err = validate(value, rule, lang);
		if (err) return err;
	}
	return '';
};
