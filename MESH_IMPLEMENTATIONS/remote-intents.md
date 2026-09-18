# Remote intents over Event Mesh

Product and checkout remotes publish local intents on the host shell's Event Mesh singleton. Hosts subscribe and own side effects (navigate, mutate cart/coupon, place orders, or cross-origin redirect). Remotes must not call `configureMesh`.

## Phase 1 contracts

| Topic | Event | Payload | Publishers | Typical host effect |
| --- | --- | --- | --- | --- |
| `catalog` | `product-open-requested` | `{ productId }` | `product-card` | Ecommerce: `navigate(/product?productId=…)`; Social: `location.assign` ecommerce PDP |
| `cart` | `item-add-requested` | `{ productId, quantity }` | `product-card`, `product-details-page` | Ecommerce: mutate cart + toast; Social: redirect to ecommerce PDP |

Helpers live in [`packages/catalog-events`](../packages/catalog-events) (`createCatalogEvents`). Scope is always `local`.

## Phase 2A contracts (catalog filters / promotions)

| Topic | Event | Payload | Publishers | Typical host effect |
| --- | --- | --- | --- | --- |
| `catalog` | `filters-apply-requested` | `{ searchQuery, minPrice, maxPrice, categoryIds }` | `product-list-page` | Ecommerce: normalize + `storePLPFilters` (storage + `filters-changed`) |
| `catalog` | `promotion-applied` | `{ filters }` (same filter shape) | `banners` | Ecommerce: `applyPromotionFilters` → PLP; Social: `location.assign` ecommerce `/products?…` |

## Phase 2B contracts (checkout)

| Topic | Event | Payload | Publishers | Typical host effect |
| --- | --- | --- | --- | --- |
| `cart` | `item-update-requested` | `{ productId, quantity }` | `checkout-items` | Ecommerce: `updateCartItem` (+ toast path via cart.changed UI) |
| `cart` | `item-remove-requested` | `{ productId }` | `checkout-items` | Ecommerce: `removeCartItem` + toast; empty cart → `render-requested` |
| `checkout` | `coupon-applied` | `{ code, discountPercentage }` | `apply-coupon` | Ecommerce: set `appState.appliedCoupon`; checkout page refreshes summary |
| `checkout` | `place-order-requested` | `{}` | `checkout-summary` | Ecommerce: `placeCheckoutOrder` command |
| `navigation` | `path-requested` | `{ path: "/products" }` | `checkout-empty` (on iframe `go-shopping`) | Ecommerce: `navigate(path)` via existing shell listeners |

Checkout helpers live in [`packages/checkout-events`](../packages/checkout-events) (`createCheckoutEvents`). Cart update/remove reuse `@shared/catalog-events`. Path requests reuse `@shared/shell-events`.

Inbound `subscribeToCartChanges` remains host-injected on checkout-items (snapshot sync, not an outbound callback).

## Export story

Integrators mount these remotes with **data / inbound adapter props only**. They register host handlers for the events above instead of passing `onFiltersChange`, `onApplyPromotion`, `onQuantityChange`, `onRemoveItem`, `onCouponApplied`, `onPlaceOrder`, or `onGoShopping`.

## Files

| Area | Path |
| --- | --- |
| Shared catalog package | `packages/catalog-events/` |
| Shared checkout package | `packages/checkout-events/` |
| Ecommerce listeners | `apps/ecommerce-shell/src/main.js`, `src/events/localMeshEventBus.js` |
| Social listeners | `apps/social-media-shell/src/main.js`, `src/events/shellEventBus.js` |
| Product list filters | `apps/product-list-page/src/ProductListView.js` |
| Banners | `apps/banners/src/promotional-banner.js` |
| Checkout remotes | `apps/checkout/src/checkout-items.ts`, `apply-coupon.ts`, `checkout-summary.ts`, `checkout-empty.ts` |
| Place-order command | `apps/ecommerce-shell/src/commands/placeCheckoutOrder.js` |

## Related docs

- Shell-local overview: [notifications.md](./notifications.md)
- Mesh auth (no tokens in payloads): [mesh-authentication.md](./mesh-authentication.md)
- Storage cache + mesh signals: [storage-coordination.md](./storage-coordination.md)
