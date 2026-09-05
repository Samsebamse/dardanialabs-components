# Dardania Labs components

Shared web components used across our client sites. Pure vanilla custom
elements — no framework, no build step, one `<script>` tag per component.

| Component | File | Purpose |
|---|---|---|
| `<dardanialabs-footer>` | `src/dardanialabs-footer.js` | Copyright + social links footer |
| `<dardanialabs-photoslider>` | `src/dardanialabs-photoslider.js` | Swipeable image slider with dots below the image |
| `<dardanialabs-mailform>` | `src/dardanialabs-mailform.js` | Contact form that submits through the platform mail API |

## Loading

Always pin a **tag** on live sites. Never `@main`: purging that path does not
re-resolve the branch to a commit, so the CDN keeps serving an older build —
measured 18 Aug 2026, `@main` returned the previous file after a publish and a
successful purge on every provider, and went on doing so for days. A `?v=`
query string does not help either; it changes the browser's cache key, never
jsDelivr's. Those `?v=` numbers still in the fleet are cache-buster counters,
not versions.

**Two kinds of component, and the script tag differs.** Getting this wrong
fails silently: a module loaded as a classic script throws on its first
`import` and the element is simply never defined, so the form does not appear
at all.

```html
<!-- Classic scripts: footer, photoslider, spinner, datepicker, timepicker -->
<script defer src="https://cdn.jsdelivr.net/gh/Samsebamse/dardanialabs-components@v1.17.0/src/dardanialabs-footer.js"></script>

<!-- Modules — they import the shared rules, so type="module" is required -->
<script type="module" src="https://cdn.jsdelivr.net/gh/Samsebamse/dardanialabs-components@v1.17.0/src/dardanialabs-mailform.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Samsebamse/dardanialabs-components@v1.17.0/src/dardanialabs-richtext.js"></script>
```

Upgrading a site = bumping the tag in that one line. `test/smoke.mjs` loads each
component the way a site does — eval for classic, import for module — so the
mismatch above is caught before it ships.

In Vue projects, register the prefix as custom elements (vite.config):

```js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('dardanialabs-') } } })
```

## Legacy tag names

These components shipped for years under an earlier brand, and each file still
registers its pre-rename tag (`rtek-footer`, `rtek-photoslider`,
`rtek-mailform`) as an alias of the new class, and still honors the old
`--rtek-*` CSS custom properties as fallbacks — so existing markup, themes,
and `rtek-mailform:*` event listeners keep working unchanged after swapping
the script URL. New sites should use the `dardanialabs-*` names everywhere
(and Vue projects that still use the old tags need their old prefix kept in
`isCustomElement`).

## `<dardanialabs-footer>`

```html
<dardanialabs-footer
  company="Company Name"
  company-number="812451269"
  registry="xk"
  founded="2020"
  facebook="https://facebook.com/…"
  instagram="https://instagram.com/…"
  developer="Dardania Labs"
  developer-url="https://dardanialabs.io"
></dardanialabs-footer>
```

Attributes: `company`, `legal-name`, `company-number`, `registry`, `country`,
`founded`, `lang`, `privacy-url`, `terms-url`, `facebook`, `instagram`,
`tiktok`, `x`, `snapchat`, `linkedin`, `whatsapp`, `developer`,
`developer-url`, `align`, `color`, `font-size`, `social-gap`, `gap`. Social
icons render only for the links you provide. The component inherits
`font-family`, `color` and `background` from its parent element.

`company-number` is the registration number on its own — digits, no label.
The label belongs to the register that issued the number, so it is looked up
from `registry` (the ISO country code of that register: `xk`, `no`, `dk`,
`al`; `country` is read as a stand-in when `registry` is absent) and rendered
in front of it — `NUI 812451269`, `Org.nr. 932 533 413`. Page `lang` picks
the spelling where the label has one (`Org. no.` in English), never which
label. A register the component has no entry for renders the bare number
rather than a guessed abbreviation.

Values may equally come from the CMS: `company_number` (aliases
`legal_number`, `org_number`), `registry`, `legal_name`, `founded`. A value
that still arrives with its label baked in — `NUI 812451269` — is printed as
it stands, so a site works before, during and after that data is migrated.

## `<dardanialabs-photoslider>`

```html
<dardanialabs-photoslider
  images='["/img/a.jpg","/img/b.jpg","/img/c.jpg"]'
  autoplay="5000"
  object-fit="cover"
  lightbox
  alt="Product gallery"
></dardanialabs-photoslider>
```

Dot indicators always render **below** the image so visitors can see how many
photos a gallery holds. Arrows appear on hover, swipe works on touch, and the
fullscreen viewer mounts on `document.body` — so it is never trapped or made
to flicker by an ancestor with a `transform` or `filter` (hover-animated
cards, drop shadows).

Hand it the **stored URLs** as they are. Each slide is drawn from the media
library's display variant (`/display/images/…`, long edge 1200), derived from
the URL it was given; the lightbox loads the original. A slide whose display
variant does not exist falls back to its original on the first error. See
`dardanialabs-media` below for the rule.

### Attributes

| Attribute | Values | Purpose |
|---|---|---|
| `images` | JSON array string | The image URLs. In Vue: `:images="JSON.stringify(arr)"`. Also settable as a property (real array or JSON string). |
| `autoplay` | ms, e.g. `5000` | Advance interval; omit to disable. Pauses on hover, and while the lightbox is open. |
| `object-fit` | `cover` \| `contain` | `cover` (default) fills the frame and **crops** the overflow — right for photos. `contain` shows the whole image — right for designed graphics with text. |
| `object-position` | `center` (default), `bottom`, … | Where the image anchors when `object-fit` leaves space. |
| `aspect` | boolean | The **image area** holds a fixed ratio and the element sizes itself around it (dots strip excluded from the ratio). Ratio comes from `--dardanialabs-aspect`, default square. |
| `dots` | `overlay` | Dots overlay the image bottom-center instead of the default strip below — for full-bleed heroes where "below" would mean off-screen. |
| `no-arrows` | boolean | Hides the prev/next arrows. |
| `lightbox` | boolean | Click an image to open the fullscreen viewer (arrows, counter, ←/→/Esc keys, backdrop click to close). |
| `alt` | text | Alt-text prefix for the slides. |
| `start` | index | Initial slide. |

### Fitting images correctly

- Photos where a crop is harmless → `object-fit="cover"`.
- Designed promos with text baked in → `object-fit="contain"`, so nothing is
  ever sliced off. In this mode the image box shrinks to the painted image
  and `--dardanialabs-radius` rounds **the image itself**, not an invisible
  letterboxed box around it.
- To eliminate letterbox gaps entirely, give the frame the images' own ratio:
  `aspect` + `--dardanialabs-aspect: 0.84`. This only works if the source
  images share one ratio — mixed ratios always letterbox somewhere unless you
  crop.

### Theming

CSS custom properties, set on the element (the pre-rename `--rtek-*` names
are still honored as fallbacks):

| Property | Default | Effect |
|---|---|---|
| `--dardanialabs-accent` | `#c4622d` | Dot and arrow color. |
| `--dardanialabs-radius` | `12px` | Corner radius of the frame (and of the image itself in `contain` mode). |
| `--dardanialabs-dots-bg` | transparent | Background of the dots strip. |
| `--dardanialabs-height` | `100%` | Image-area height when not using `aspect`. |
| `--dardanialabs-aspect` | `1` | Image-area ratio; only applies with the `aspect` attribute. |

Tip: when the dots strip sits on the page background, use
`filter: drop-shadow(...)` on the element rather than `box-shadow` — the
shadow then hugs the image instead of boxing in the dots.

## `<dardanialabs-mailform>`

```html
<dardanialabs-mailform
  lang="no"
  require-code
  show-mobile
  show-subject
></dardanialabs-mailform>
```

Submits `POST {api}/mail` with
`{ data: { name, mobile, email, subject, message, lang, company, …tenant fields } }`.
The server resolves the tenant from the request Origin, so the same embed works
on any site — the tenant needs `mail_form` enabled and a `contact_email`
configured.

### Validation: one recipe, both sides

```
        dardanialabs-validators.js          ← common rules live here, once
         name · email · phone · message
                    │
        ┌───────────┴────────────┐
        │                        │
   the form imports it      the server vendors a copy
   gates before sending     gates again, authoritative
        │                        │
        └───────────┬────────────┘
                    │
        tenant_validators (DB)   ← the per-tenant override layer
        field_key → rule/pattern/messages
                    │
        server reads data[field_key]
```

**Common rules are shared, not re-implemented.** The form imports
`dardanialabs-validators.js` — the same file the server keeps a vendored copy
of for its own gate — so a field that passes in the browser passes on the
server. When the form carried its own weaker checks instead, a nine-digit
Norwegian phone number and a name like `Firma 24` reached the API and came back
as an unexplained 400.

**Validation is eager.** Every keystroke checks the field; a blank field never
shows a message, because someone who has not finished typing has not made a
mistake yet; leaving a field re-checks it. An invalid form sends nothing at
all — the server is never asked to refuse what the browser already knows is
wrong.

**Tenant rules are the override layer, and they need the field.** Custom fields
and the code are sent under their own names *as well as* appearing in the
message body, because `tenant_validators` is looked up by `field_key` and read
from `data[field_key]`. While they travelled only inside the message text, a
tenant's `required` rule read `undefined` and refused every submission, and a
`pattern` rule passed anything at all.

Two rules worth knowing:

- A tenant field may **not** take one of the form's own payload keys (`name`,
  `mobile`, `email`, `subject`, `message`, `lang`, `company`). It is ignored
  rather than allowed to overwrite the visitor's own address.
- Server-side, a rule for a field the form does **not send** is skipped and
  logged, not failed. An absent field means a reconfigured form left a stale
  rule behind; an *empty* field means the visitor left it blank, which
  `required` should still refuse.

When the server does refuse (its rules are authoritative, and tenant rules only
exist there), the 400 body names each field — `{ ok: false, errors: { field:
message } }` — and the form paints those onto the fields themselves instead of
showing one generic banner.

- `api`: API base, default `https://api.dardanialabs.io/v1/public`.
- `lang`: `no` | `en` | `sq` (built-in strings).
- `require-code`: adds a mandatory code field — 3 letters + 2 digits by
  default (`code-pattern` overrides the regex, `code-example` the hint).
  The code is validated live (auto-uppercase, tip box, green check) and
  leads the `extras` list (below), so it heads the detail rows in the mail.
- `show-mobile`, `show-subject`: optional extra fields.
- `fields`: JSON array of custom inputs rendered before the message box, e.g.
  `fields='[{"name":"dates","label":{"no":"Ønsket tid","en":"Preferred dates"},"type":"text","required":true}]'`.
  Types: `text`, `tel`, `select`, `textarea`. `label`/`placeholder`/`options`
  accept plain strings or `{ no, en, sq }` objects resolved by `lang`.
  Values are sent under their own names in `data` **and** as `data.extras` —
  `[{ label, value }]` in declaration order, labels as the form showed them.
  The first is what `tenant_validators` gates on; the second is what a human
  reads: the mail templates render each entry as its own labelled row in the
  details card of both letters, next to name and phone. Nothing is folded
  into the message any more — `data.message` is the visitor's words only.
  (Before v1.25.0 these were folded in as "Label: value" lines, and mail HTML
  collapses newlines, so a dropdown choice ran straight into the visitor's
  first sentence.) `required` fields validate like the built-in ones. Exception: an extra field named `subject`
  becomes the mail's actual subject line (useful for a localized subject
  select). Names that collide with the form's own payload keys are ignored —
  see *Validation* above.
- Full custom validation: per-field messages, highlight + shake, focus jumps
  to the first invalid field.
- Events: `dardanialabs-mailform:sent`, `dardanialabs-mailform:error` (each
  is also dispatched under its pre-rename name for older listeners).

Theming (pre-rename `--rtek-*` names still honored as fallbacks):

| Property | Default | Effect |
|---|---|---|
| `--dardanialabs-accent` | `#c4622d` | Accent color (buttons, focus). |
| `--dardanialabs-text` | `#2c2c2c` | Text color. |
| `--dardanialabs-bg` | `#ffffff` | Form background. |
| `--dardanialabs-input-bg` | `#faf7f2` | Input background. |
| `--dardanialabs-border` | `#ddd5c8` | Input border color. |
| `--dardanialabs-radius` | `12px` | Corner radius. |
| `--dardanialabs-error` | `#b3402a` | Error color. |
| `--dardanialabs-success` | `#3d5142` | Success color. |

## `dardanialabs-richtext.js`

A plain ES module (no custom element) that turns a CMS text field into real
markup. Use it **everywhere a CMS value used to reach `innerHTML`** — that
habit turned every plain-text field into a markup field, and tenants answered
it by typing their own pseudo-markup (`• Item<br/>`), which is neither a list
nor styleable nor announced as a list by a screen reader.

```js
import { renderInto, toFragment, CLASSES } from './dardanialabs-richtext.js';

renderInto(cardBody, record.description);             // blocks: <p> / <ul> / <ol>
renderInto(heading, record.title, { inline: true });  // inline only, no <p> wrapper
node.appendChild(toFragment(record.description));     // build it yourself
```

Sites without a bundler load it as a module script and read the same API off
the global it publishes — module scripts run before `window.onload`, so it is
in place by the time a classic `index.js` renders:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Samsebamse/dardanialabs-components@main/src/dardanialabs-richtext.css?v=1.12.0">
<script type="module" src="https://cdn.jsdelivr.net/gh/Samsebamse/dardanialabs-components@main/src/dardanialabs-richtext.js?v=1.12.0"></script>
<script>window.dardanialabsRichtext.renderInto(el, text);</script>
```

### Syntax

| Input | Output |
|---|---|
| `- item` / `* item` (consecutive lines) | one `<ul>`, an `<li>` per line |
| `1. item` (consecutive lines, any digits) | one `<ol>` |
| blank line | ends the block; each block of prose becomes a `<p>` |
| single newline inside a paragraph | a space — **not** a `<br>` |
| `**text**` | `<strong>` |
| `*text*` | `<em>` |
| `[label](https://…)` | `<a target="_blank" rel="noopener noreferrer">` |
| anything else | literal text |

### Safety

It is a **whitelist, not a sanitizer**. A sanitizer starts from "allow
everything, then subtract the dangerous parts" — a list you can never finish.

1. `innerHTML` is never used anywhere in the module. Nodes come from
   `createElement`, characters from `textContent`, so `<` is text by
   construction: a tenant typing `<script>` sees `<script>` on the page. There
   is nothing to escape, so there is nothing an escaper could miss.
2. A link target must start with `https://` (case-insensitive). `javascript:`,
   `data:`, `//host`, relative paths — none of them link; the whole
   `[label](…)` prints as typed.
3. Unknown syntax degrades to literal text, never to an error and never to a
   silent drop. Legacy `<br/>` therefore becomes visible characters — the
   loudest possible hint that the field needs cleaning up.

### Classes and theming

Every emitted element carries its own class, so a stylesheet never depends on
an ancestor: `dl-rt` (stamped by `renderInto` on the element it fills),
`dl-rt-p`, `dl-rt-ul`, `dl-rt-ol`, `dl-rt-li`, `dl-rt-link`. The names are
also exported as `CLASSES`.

`src/dardanialabs-richtext.css` carries the list *mechanics* — markers
`outside` with a gutter so a wrapped line hangs under the first character,
never `inside`; spacing between items; a measure. Tenants theme colour and
rhythm through `--dardanialabs-rt-measure`, `-line-height`, `-block-gap`,
`-item-gap`, `-indent`, `-bullet`, `-number`, `-marker-color`,
`-marker-size`, `-link-color`.

## `dardanialabs-media.js`

The URL rules for images stored in the media library. Every image exists in
three sizes, each derived from the original's URL — no lookup, no extra
column:

| Size | URL | Used by |
|---|---|---|
| original | `https://<tenant>.dardanialabs.io/images/<key>` | the lightbox, and nothing else |
| display — long edge 1200, JPEG q80 | `…/display/images/<key>` | every grid, card, slider and detail page |
| thumbnail — 200×200 | `…/thumbnails/images/<key>` | the CMS panel; never a public page |

```js
import { displayUrl, fallbackToOriginal } from 'https://cdn.jsdelivr.net/gh/Samsebamse/dardanialabs-components@v1.26.0/src/dardanialabs-media.js';
```

```html
<img :src="displayUrl(url)" @error="fallbackToOriginal" loading="lazy" />
```

- `displayUrl(url)` — the display variant of a stored URL. Anything that is not
  a library original under `/images/` (a video, a file, a site asset, an SVG or
  GIF, which have no variant) comes back unchanged, so every image a page draws
  can go through it.
- `originalUrl(url)` — the inverse.
- `fallbackToOriginal(event)` — an `error` handler that swaps the element to
  its original once. A variant that does not exist costs one failed request
  and then renders exactly as before.

Loaded as a classic script, the same three are on `window.dardanialabsMedia`.
The photoslider applies the rule on its own — slides from the display variant,
lightbox from the original — so a site hands it the stored URLs untouched. The
Vue sites carry a copy of this file at `src/utils/media.js` rather than
importing it from the CDN, because a static `import` of a CDN URL puts one
round trip in front of the whole app; `test/smoke.mjs` holds the canonical
behaviour.

## `dardanialabs-price.js`

How a public site prints a catalogue price, and what it says when there is
none. A `price` column is numeric or empty, and empty means *not published* —
most of a showroom's range is quoted on request. That wording is rendered, never
stored: nothing is written into the column, and no structured data claims a
price that does not exist (a Product's `offers` is omitted entirely for such a
row — an Offer without a price earns no rich result, and a made-up or zero price
is a Merchant Center policy problem).

The rule sits at both ends of the app, and the default is the point: a site
normalises the column with `priceValue` where the API answer is shaped, and
prints with `priceText` wherever a price appears. Nothing in between decides
whether to show the wording — a missing price is `null` everywhere and the
print function never returns an empty string, so a price slot cannot read
``, `€`, `NaN` or `0`.

```js
import { priceValue, priceText, formatPrice, priceOnRequest } from 'https://cdn.jsdelivr.net/gh/Samsebamse/dardanialabs-components@v1.28.0/src/dardanialabs-price.js';
```

- `priceValue(value)` — `'272'` → `272`, `163.2` → `163.2`; `null`, `''`, `0`,
  negatives and anything non-numeric → `null`. The shape a site stores.
- `formatPrice(value, currency = '€')` — `272` → `€272`, `163.2` → `€163.20`;
  anything `priceValue` rejects → `''`.
- `priceOnRequest(lang)` — `sq` *Çmimi sipas kërkesës*, `en` *Price on request*,
  `no` *Pris på forespørsel*; English for any other language.
- `priceText(value, lang)` — the price when there is one, the wording when not.
  Never empty.

Loaded as a classic script, the same functions are on `window.dardanialabsPrice`.
As with `dardanialabs-media.js`, the Vue sites carry a copy at
`src/utils/price.js`; `test/smoke.mjs` holds the canonical behaviour.

## Releasing

Published versions are immutable — the publish script refuses to overwrite an
existing version.

1. Edit the component in `src/`.
2. Bump `version` in `package.json`, run `npm test`, commit.
3. Tag: `git tag vX.Y.Z && git push origin main --tags`.
4. Publish to the CDN:
   `node --env-file=<path-to-env> scripts/publish.mjs`
   (needs `CLOUDFLARE_S3_API`, `CLOUDFLARE_R2_ACCESS_KEY_ID`,
   `CLOUDFLARE_R2_SECRET_ACCESS_KEY`).
5. Bump the version in the sites that should pick up the change.

## Lessons (do not regress these)

- **Every attribute-backed getter needs a reflecting setter.** Frameworks
  (Vue, React) assign DOM *properties*, not attributes — `:images="…"` runs
  `el.images = value`. A class with only a getter silently swallows that
  assignment (the accessor shadows it), and the component renders empty with
  no error. This bit us in production: `images`, `lang`, and `api` all have
  setters that reflect to the attribute, and `images` accepts both a real
  array and a JSON string. Keep it that way for any new attribute.
- **The photoslider lightbox must mount on `document.body`.** A
  `position: fixed` overlay rendered inside the component gets trapped (and
  flickers) whenever any ancestor has a `transform` or `filter` — which
  hover-animated cards and drop-shadow wrappers create constantly. Fixed
  positioning containing blocks are a spec behavior, not a browser bug;
  appending the overlay to `document.body` is the fix.
- **A CMS value never reaches `innerHTML` or `v-html`.** Use
  `dardanialabs-richtext.js`. Injecting the value silently redefines every
  plain-text field as a markup field, and tenants then fill those fields with
  pseudo-markup because it is the only formatting they have — which is how
  Bymico ended up with hand-typed `• Item<br/>` lists that no stylesheet could
  align. The parser gives them real lists and closes the injection in the same
  move.
- **Dots render below the image by default.** Visitors need to see how many
  photos a gallery holds without anything covering the picture;
  `dots="overlay"` is the explicit opt-in for full-bleed heroes.
