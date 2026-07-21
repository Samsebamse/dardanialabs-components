# DardaniaLabs components — roadmap

Parked ideas / future work. Nothing here is committed to a date.

## Shared hint-box (two-tone, compact) — fleet-wide validation feedback

Today validation feedback is inconsistent: the digital_detox **code** field uses a nice
tip-box (💡 accent border + icon + guidance text), while other fields show a plain red
line. The tip-box reads as *help*, not *scolding* — we like it and want it everywhere.

**Idea:** define ONE hint presentation in the shared layer so every form (mailform web
component + app forms like BookPage) inherits the identical look for free (rides `@main`).

Design notes:
- **Two tones, one shape.** Same box; color carries severity:
  - *guiding* (calm/accent) while helping the user format a field (e.g. code, phone)
  - *error* (red) for a hard failure (invalid value, failed submit)
  Keeps the friendly look without losing the "red = fix this" instinct.
- **Compact = low visual weight, NOT clamped text.** Never truncate a validation
  message. Reduce the *chrome*: tighter padding (biggest lever), lighter/no background,
  smaller or no icon, thin accent bar instead of a full border, tighter line-height.
  Short hints land on one line; long ones (e.g. the phone hint) wrap without becoming a wall.
- **Reserve the space.** Keep ~1 line of height under each field always present so
  toggling the hint doesn't shove the layout up/down (minor shift acceptable for rare 2-line hints).
- **Accessibility.** `aria-live` / `role="alert"` on the box; decorative icon `aria-hidden`.

**Deliverable:** a shared hint-box style/component (guiding vs error tone + reserved
space + compact chrome). Pilot on BookPage, then it becomes the fleet default.

Status: idea only — left as-is for now (2026-07-21).
