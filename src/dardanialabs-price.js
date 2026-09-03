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
 * Usage as a module (Vue sites):
 *
 *   import { formatPrice, priceOnRequest } from '.../dardanialabs-price.js';
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
 * A published price as the sites print it: currency first, no thousands
 * separator, cents only when the value has them. Empty for a row with no
 * published price — a zero is treated the same, since no product is free.
 *
 * @param {number|string|null|undefined} value
 * @param {string} [currency='€']
 * @returns {string}
 */
export function formatPrice(value, currency = '€') {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
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
 * published, the on-request wording otherwise.
 *
 * @param {number|string|null|undefined} value
 * @param {string} lang
 * @param {string} [currency='€']
 * @returns {string}
 */
export function priceText(value, lang, currency = '€') {
  return formatPrice(value, currency) || priceOnRequest(lang);
}

const api = { PRICE_ON_REQUEST, formatPrice, priceOnRequest, priceText };
if (typeof globalThis !== 'undefined') globalThis.dardanialabsPrice = api;
export default api;
