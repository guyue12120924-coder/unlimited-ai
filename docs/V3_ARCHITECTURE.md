# Unlimited AI V3 Architecture

V3 keeps the proven writing/storage stack stable and gives the product experience a single runtime boundary.

## Stable core

These modules own data, writing state, AI context, continuity, and export/backup behavior. Product UI code should not duplicate their storage logic.

- `app.js`
- `studio.js`
- `simple-studio.js`
- `workflow.js`
- `story-intelligence.js`
- `context-bridge.js`
- `continuity-bridge.js`
- `memory-bridge.js`
- `memory-suggest.js`

## Product adapters

The V2 adapters remain compatibility modules because they have already been validated in the live writing flow:

- `user-flow.js`
- `ai-to-manuscript.js`
- `v2-experience.js`
- `v2-product.js`
- `v2-product-phase2.js`
- `v2-product-phase3.js`

They are loaded only after `v3-runtime.js`.

## V3 runtime rule

`v3-runtime.js` is the coordination boundary for product adapters. It frame-batches MutationObserver deliveries, owns cross-adapter refresh, owns the former outline refresh workaround, and exposes `window.UnlimitedV3` for diagnostics.

New product features should prefer the V3 runtime instead of adding another global MutationObserver, polling loop, inline script, or duplicate refresh scheduler.

## CSS rule

Feature-specific styles stay with their feature adapter. `v3-product.css` is only for cross-version normalization and final runtime-level fixes. Avoid adding another phase stylesheet after V3.

## Regression rule

`tests/product-flow.test.mjs` protects the user path and V3 load order. Any future change must keep the core flow intact:

first run → AI creation → add/apply to manuscript → complete chapter → next chapter → mobile navigation → full data backup.
