/**
 * Media URL rules for the public sites.
 *
 * Every image the media library stores exists in three sizes, and the URL of
 * each is derived from the original's — no lookup, no extra field on the
 * record:
 *
 *   https://<tenant>.dardanialabs.io/images/<key>              original
 *   https://<tenant>.dardanialabs.io/display/images/<key>      long edge 1200, JPEG q80
 *   https://<tenant>.dardanialabs.io/thumbnails/images/<key>   200×200, the CMS panel's
 *
 * A public site draws grids, cards, sliders and detail pages from the DISPLAY
 * variant. The original is loaded in exactly one place: the lightbox, where
 * someone has deliberately asked to look closely. The thumbnail is the CMS
 * panel's and is never used on a public page.
 *
 * Usage as a module (Vue sites):
 *
 *   import { displayUrl, fallbackToOriginal } from '.../dardanialabs-media.js';
 *   <img :src="displayUrl(url)" @error="fallbackToOriginal" />
 *
 * Usage as a classic script: the same functions on window.dardanialabsMedia.
 *
 * The server derives the same key in getDisplayPath; the photoslider carries
 * a copy of displayUrl because it is a classic script and cannot import this
 * file. test/smoke.mjs checks the three agree.
 */

// Formats that have no display variant. The server declines to make one — an
// SVG rasterised is worse than the vector, a GIF flattened has lost its
// animation — so asking for it would be a guaranteed 404.
const NO_DISPLAY = /\.(svg|gif)(\?.*)?$/i;

/**
 * The display-size URL for a stored image URL.
 *
 * Only a media-library original — a path under /images/ — has one. Anything
 * else (a video, a file, a URL from outside the library, a relative asset of
 * the site itself) is handed back unchanged, so the caller can pass every
 * image it draws through here without checking first.
 *
 * @param {string} url
 * @returns {string}
 */
export function displayUrl(url) {
  if (typeof url !== 'string' || !url) return url;
  if (NO_DISPLAY.test(url)) return url;
  return url.replace(/^(https?:\/\/[^/]+)\/images\//, '$1/display/images/');
}

/**
 * The original behind a display-size URL. The inverse of displayUrl; a URL
 * that is not a display variant comes back unchanged.
 *
 * @param {string} url
 * @returns {string}
 */
export function originalUrl(url) {
  if (typeof url !== 'string' || !url) return url;
  return url.replace(/^(https?:\/\/[^/]+)\/display\/images\//, '$1/images/');
}

/**
 * Error handler for an <img> drawn from a display URL: on the first failure it
 * swaps the element to the original and stops listening, so a variant that
 * does not exist (an object from outside the library, a variant not yet
 * written) costs one failed request and then renders exactly as before.
 *
 * Bind it directly — `@error="fallbackToOriginal"` — or call it with the event.
 *
 * @param {Event} event
 */
export function fallbackToOriginal(event) {
  const img = event && event.target;
  if (!img || !img.src) return;
  const original = originalUrl(img.src);
  if (original === img.src) return;
  img.removeEventListener('error', fallbackToOriginal);
  img.src = original;
}

const api = { displayUrl, originalUrl, fallbackToOriginal };
if (typeof globalThis !== 'undefined') globalThis.dardanialabsMedia = api;
export default api;
