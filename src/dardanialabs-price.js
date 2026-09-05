/**
 * Price display rules for the public sites.
 *
 * A catalogue row's `price` column is numeric or empty, and empty means "not
 * published", never zero: most of a showroom's range is quoted on request.
 * That wording is a rendering decision, not a value — nothing is written into
 * the column, and no structured data claims a price that does not exist. A
 * Product's `offers` is left out entirely for such a row: an Offer without a
 * price earns no rich result, and a made-up or zero price is a Merchant Center
 * policy problem, not just an untidy one.
 *
 * Two functions carry the rule, one at each end of the app:
 *
 *   priceValue(raw)   at the API boundary — the column becomes a positive
 *                     number or null, so "no price" is ONE value downstream,
 *                     whatever the server sent ("", "0", "abc", null, 12.5).
 *   priceText(n, lang) wherever a price is printed — the price when there is
 *                     one, the on-request wording when there is not. It never
 *                     returns an empty string, so a page that prints it can
 *                     never show "", "€", "NaN" or "0" in a price slot.
 *
 * Usage as a module (Vue sites):
 *
 *   import { priceValue, priceText, formatPrice, priceOnRequest } from '.../dardanialabs-price.js';
 *   priceValue('272')       → 272;   priceValue('') → null;   priceValue(0) → null
 *   formatPrice(272)        → "€272"
 *   formatPrice(163.2)      → "€163.20"      (cents only when there are any)
 *   formatPrice(null)       → ""             (also "", 0 and anything non-numeric)
 *   priceOnRequest('sq')    → "Çmimi sipas kërkesës"
 *   priceText(272, 'sq')    → "€272";  priceText(null, 'sq') → "Çmimi sipas kërkesës"
 *
 * Usage as a classic script: the same functions on window.dardanialabsPrice.
 */

/** What a page says where a price would go and none is published. */
export const PRICE_ON_REQUEST = Object.freeze({
  sq: 'Çmimi sipas kërkesës',
  en: 'Price on request',
  no: 'Pris på forespørsel',
});

/**
 * The number a row's `price` column carries, or null when it carries no
 * published price. Empty, zero, negative and non-numeric all mean "not
 * published" — no product is free, and a column edited by hand can hold
 * anything.
 *
 * @param {number|string|null|undefined} value
 * @returns {number|null}
 */
export function priceValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A published price as the sites print it: currency first, no thousands
 * separator, cents only when the value has them. Empty for a row with no
 * published price — a zero is treated the same, since no product is free.
 *
 * @param {number|string|null|undefined} value
 * @param {string} [currency='€']
 * @returns {string}
 */
export function formatPrice(value, currency = '€') {
  const n = priceValue(value);
  if (n === null) return '';
  return `${currency}${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

/**
 * The "price on request" wording for a language, English when the language
 * has none.
 *
 * @param {string} lang
 * @returns {string}
 */
export function priceOnRequest(lang) {
  return PRICE_ON_REQUEST[lang] || PRICE_ON_REQUEST.en;
}

/**
 * The text a page shows in its price slot: the formatted price when one is
 * published, the on-request wording otherwise. Never empty.
 *
 * @param {number|string|null|undefined} value
 * @param {string} lang
 * @param {string} [currency='€']
 * @returns {string}
 */
export function priceText(value, lang, currency = '€') {
  return formatPrice(value, currency) || priceOnRequest(lang);
}

const api = { PRICE_ON_REQUEST, priceValue, formatPrice, priceOnRequest, priceText };
if (typeof globalThis !== 'undefined') globalThis.dardanialabsPrice = api;
export default api;
