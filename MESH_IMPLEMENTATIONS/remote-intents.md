# Remote intents over Event Mesh

Product, checkout, account, community, and login remotes publish local intents on the host shell's Event Mesh singleton. Hosts subscribe and own side effects. Remotes must not call `configureMesh`. **JWT never appears in mesh payloads.**

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

## Phase 2C contracts (account / community / formulary)

| Topic | Event | Payload | Publishers | Typical host effect |
| --- | --- | --- | --- | --- |
| `account` | `profile-save-requested` | `{ fullName, gender }` | `account-profile` | Ecommerce/social/admin: `persistAccountUpdate` |
| `account` | `address-save-requested` | `{ street, city, state, postalCode, country }` | `account-address` | Same with `{ address }` wrap |
| `community` | `post-liked` | `{ postId }` | `post-feed` | Social: stub log (same as prior callback) |
| `community` | `author-selected` | `{ author }` | `post-feed` | Social: stub log |
| `community` | `post-submitted` | `{ content, imageUrl }` | `new-post-formulary` mount | Social: `persistNewPost` + toast + re-render |
| `community` | `faq-submitted` | FAQ fields | `faq-formulary` mount (orphan) | Optional; ecommerce home FAQ stays shell-owned bridge |

Helpers: [`packages/account-events`](../packages/account-events), [`packages/community-events`](../packages/community-events).

## Phase 2D contracts (login)

| Topic | Event | Payload | Publishers | Typical host effect |
| --- | --- | --- | --- | --- |
| `auth` | `session-changed` | `{}` | `login` (after writing shell auth keys) | Shell: `readStoredAuth` → mesh lifecycle → welcome toast if newly authenticated → re-render |
| `navigation` | `path-requested` | `{ path }` | `login` (cancel `/`; success redirect/default) | Shell: `navigate(path)` |

Login keeps HTTP POST `/auth/login` inside the remote. Host injects `authTokenStorageKey`, `authUserStorageKey`, `defaultRedirectPath`, optional `requiredRole`. **No JWT on mesh.**

## Export story

Integrators mount these remotes with **data / inbound adapter props only**. They register host handlers for the events above instead of passing outbound callbacks (`onLoginSuccess`, `onSaveProfile`, `onFormSubmitted`, etc.).

## Files

| Area | Path |
| --- | --- |
| Shared catalog package | `packages/catalog-events/` |
| Shared checkout package | `packages/checkout-events/` |
| Shared account package | `packages/account-events/` |
| Shared community package | `packages/community-events/` |
| Ecommerce listeners | `apps/ecommerce-shell/src/main.js`, `src/events/localMeshEventBus.js` |
| Social listeners | `apps/social-media-shell/src/main.js`, `src/events/shellEventBus.js` |
| Admin listeners | `apps/admin-shell/src/main.js`, `src/events/shellEventBus.js` |
| Account remotes | `apps/account/src/account-profile.js`, `account-address.js` |
| Post feed | `apps/social-media-posts/src/post-feed.js` |
| Formulary mounts | `apps/formulary/src/new-post-formulary.js`, `faq-formulary.js` |
| Login | `apps/login/src/login-form.js` |

## Related docs

- Shell-local overview: [notifications.md](./notifications.md)
- Mesh auth (no tokens in payloads): [mesh-authentication.md](./mesh-authentication.md)
- Storage cache + mesh signals: [storage-coordination.md](./storage-coordination.md)
