# Dardania Labs components

Shared web components used across our client sites. Pure vanilla custom
elements — no framework, no build step, one `<script>` tag per component.

| Component | File | Purpose |
|---|---|---|
| `<dardanialabs-footer>` | `src/dardanialabs-footer.js` | Copyright + social links footer |
| `<dardanialabs-photoslider>` | `src/dardanialabs-photoslider.js` | Swipeable image slider with dots below the image |
| `<dardanialabs-mailform>` | `src/dardanialabs-mailform.js` | Contact form that submits through the platform mail API |

## Loading

Always pin a **version** on live sites — published versions are immutable:

```html
<script defer src="https://cdn.dardanialabs.io/components/v1.0.0/dardanialabs-footer.js"></script>
<script defer src="https://cdn.dardanialabs.io/components/v1.0.0/dardanialabs-photoslider.js"></script>
<script defer src="https://cdn.dardanialabs.io/components/v1.0.0/dardanialabs-mailform.js"></script>
```

Upgrading a site = bumping the version in that one line.

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
  founded="2020"
  facebook="https://facebook.com/…"
  instagram="https://instagram.com/…"
  developer="Dardania Labs"
  developer-url="https://dardanialabs.io"
></dardanialabs-footer>
```

Attributes: `company`, `founded`, `facebook`, `instagram`, `tiktok`, `x`,
`snapchat`, `linkedin`, `whatsapp`, `developer`, `developer-url`, `align`,
`color`, `font-size`, `social-gap`, `gap`. Social icons render only for the
links you provide. The component inherits `font-family`, `color` and
`background` from its parent element.

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
`{ data: { name, mobile, email, subject, message, lang } }`. The server
resolves the tenant from the request Origin, so the same embed works on any
site — the tenant needs `mail_form` enabled and a `contact_email` configured.

- `api`: API base, default `https://api.dardanialabs.io/v1/public`.
- `lang`: `no` | `en` | `sq` (built-in strings).
- `require-code`: adds a mandatory code field — 3 letters + 2 digits by
  default (`code-pattern` overrides the regex, `code-example` the hint).
  The code is validated live (auto-uppercase, tip box, green check) and
  prepended to the message body.
- `show-mobile`, `show-subject`: optional extra fields.
- `fields`: JSON array of custom inputs rendered before the message box, e.g.
  `fields='[{"name":"dates","label":{"no":"Ønsket tid","en":"Preferred dates"},"type":"text","required":true}]'`.
  Types: `text`, `tel`, `select`, `textarea`. `label`/`placeholder`/`options`
  accept plain strings or `{ no, en, sq }` objects resolved by `lang`.
  Values are folded into the message body as "Label: value" lines;
  `required` fields validate like the built-in ones. Exception: an extra
  field named `subject` becomes the mail's actual subject line (useful for
  a localized subject select).
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

## Releasing

Published versions are immutable — the publish script refuses to overwrite an
existing version.

1. Edit the component in `src/`.
2. Bump `version` in `package.json`, run `node test/smoke.mjs`, commit.
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
- **Dots render below the image by default.** Visitors need to see how many
  photos a gallery holds without anything covering the picture;
  `dots="overlay"` is the explicit opt-in for full-bleed heroes.
