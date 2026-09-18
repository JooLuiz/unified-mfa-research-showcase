# Remote intents over Event Mesh

Product remotes publish local catalog intents on the host shell's Event Mesh singleton. Hosts subscribe and own side effects (navigate, mutate cart, or cross-origin redirect). Remotes must not call `configureMesh`.

## Phase 1 contracts

| Topic | Event | Payload | Publishers | Typical host effect |
| --- | --- | --- | --- | --- |
| `catalog` | `product-open-requested` | `{ productId }` | `product-card` | Ecommerce: `navigate(/product?productId=…)`; Social: `location.assign` ecommerce PDP |
| `cart` | `item-add-requested` | `{ productId, quantity }` | `product-card`, `product-details-page` | Ecommerce: mutate cart + toast; Social: redirect to ecommerce PDP |

Helpers live in [`packages/catalog-events`](../packages/catalog-events) (`createCatalogEvents`). Scope is always `local`.

## Export story

Integrators mount product remotes with **data props only** (product, apiBaseUrl, filters, etc.). They register host handlers for the events above instead of passing `onProductClick` / `onAddToCart`.

## Files

| Area | Path |
| --- | --- |
| Shared package | `packages/catalog-events/` |
| Ecommerce listeners | `apps/ecommerce-shell/src/main.js`, `src/events/localMeshEventBus.js` |
| Social listeners | `apps/social-media-shell/src/main.js`, `src/events/shellEventBus.js` |
| Product card | `apps/product-card/src/product-card-component.js` |
| Product details add | `apps/product-details-page/src/product-details-adapter.ts` |

## Related docs

- Shell-local overview: [notifications.md](./notifications.md)
- Mesh auth (no tokens in payloads): [mesh-authentication.md](./mesh-authentication.md)
