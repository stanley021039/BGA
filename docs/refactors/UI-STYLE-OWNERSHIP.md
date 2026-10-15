# UI presentation ownership

2026-10-15. Scope: current Draw and Quacks presentation. Preserve their existing
appearance and game-specific layouts while giving changes a predictable owner.

## Dependency direction

`ui-foundation.css` supplies site UI primitives and spacing/control tokens.
`template-tokens.css` adapts that foundation for the opt-in tactile template;
`template-components.css` and `template-layout.css` retain the generic template.
The current polished presentation adapts those lower-level modules through:

| Owner | Responsibility |
| --- | --- |
| `shared/stitch-tokens.css` | Stitch palette, aliases and stable room/workbench slot sizes |
| `shared/stitch-skin.css` | Paint, typography and motion; no placement or dimensions |
| `shared/stitch-composition.css` | Shared room/waiting geometry and Draw workbench/phase geometry; no paint |
| `quacks-theme.css` | Quacks palette, type, paint and motion |
| `quacks-layout.css` | Active Quacks panels, action slots and responsive geometry |

`stitch-fidelity.css` and `quacks-stitch.css` remain compatibility entry points.
Their imports preserve the current HTML dependency order. Quacks waiting keeps
using the shared room composition. Its active cauldron/shop UI keeps its own
layout. The Draw workbench remains phase/role scoped and is not a generic game
grid that other games must adopt.

## Cascade contract

Retain the existing `stitch-export` layer and unlayered declarations. Important
declarations in a named layer precede unlayered important declarations; a blanket
layer wrapper would reverse established precedence. No new competing layers are
introduced. Skin/layout separation keeps shorthand families together: font and
border stay in skin; margin/padding, inset, grid/flex, gap/alignment and overflow
stay in composition.

The mechanical partition conserved all 3,599 Stitch and 2,181 Quacks declarations,
selectors, media conditions and layer paths. Both per-property and shorthand-family
declaration order were compared before token substitutions; neither reordered.
Existing keyframe bodies remain intact in the skin owner. The audit and original
CSS are retained outside the repository with the implementation backup.

Then 122 geometry declarations were changed to reference equal-value tokens.
Existing `--st-gap`, `--st-panel-gap`, `--st-panel-padding`, roster/chat width
tokens and Quacks density tokens now control their corresponding repeated values.
New named slots cover the room seat/status and drawing workbench tools/header/footer.
This avoids editing multiple separate literals when changing those dimensions.

`node tools/check-ui-style-ownership.cjs` is a lightweight source ownership check,
not a browser regression suite. Run it when editing these presentation owners.
It rejects geometry added to skin, paint added to layout, and non-token declarations
added to the shared theme tokens. Exact selectors and existing important rules are
retained deliberately; a later specificity cleanup needs its own visual evidence.

## Validation scope

Real Chromium loaded the test site with the same current JavaScript, same room and
same state, routing the two old CSS entry points to the saved originals for the
before pages. Compared every DOM element's rectangle plus 29 computed style
properties (layout, dimensions, spacing, paint and typography), and captured both
screenshots. At 1440/390/320px in light/dark, host and guest waiting for both games
gave 24 comparisons with zero differences. Actual API-started Draw drawing and
Quacks fortune states gave another 24 comparisons; only running countdown fill
and decorative bubble/steam animation rectangles differed by sample time, with no
computed style differences. Repeating those 24 active comparisons under the
browser's reduced-motion preference gave zero differences including rectangles.
All 72 comparisons had no horizontal page overflow and no page errors. Created
QA rooms were left and synthetic QA accounts disabled afterwards.

The active comparison intentionally froze state responses and browser clock for
CSS isolation; it does not establish gameplay timing, animation quality or all
Quacks phases. Long content, pending/state transitions and focus mode need the
main implementation's functional test-site validation. No full test suite, PR or
production release is part of this refactor. Evidence and before/after screenshots
are retained outside the repository in the CSS refactor scratch directory.

## Remaining locality limits

Generic template and legacy game styles still exist as lower-level adapters.
The compatibility layer intentionally shields the polished UI from their earlier
rules. Draw and shared room composition remain in one geometry owner because they
currently share many selectors and source-order interactions. This change separates
paint from layout and centralizes dimensions; it does not claim all legacy CSS or
specificity debt has been removed.
