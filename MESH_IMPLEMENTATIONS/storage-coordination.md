# Web storage coordination over Event Mesh

Live coordination that previously used web storage as a *communication channel* now publishes local Event Mesh events. `localStorage` / `sessionStorage` remain reload and tab caches only. Bearer tokens never appear in mesh payloads.

## Split

| Concern | Live signal | Durable cache |
| --- | --- | --- |
| Post-login redirect (all shells) | `navigation.post-login-redirect-changed` | Shell `sessionStorage` key |
| PLP filters (ecommerce) | `catalog.filters-changed` | `ecommerce-shell:plp-filters` |
| Order Details auth | Host-injected `getAuthToken` (no mesh) | Shell still persists JWT in `localStorage` for cold start / mesh tickets |

## Order Details auth injection

The order-details MFE does not read `ecommerce-shell:auth-token`. The ecommerce shell injects `getAuthToken: () => appState.authToken || ""` when mounting, matching the checkout `subscribeToCartChanges` host-injection pattern.

```text
orderPages → mountOrderDetails({ apiBaseUrl, getAuthToken })
useOrderDetails → getAuthToken() → GET /orders/:id Authorization Bearer
```

## Post-login redirect

| Direction | Topic | Event | Payload | Scope |
| --- | --- | --- | --- | --- |
| Shell | `navigation` | `post-login-redirect-changed` | `{ path: string \| null }` | `local` |

- `rememberPostLoginRedirect(path)` writes sessionStorage, then publishes `{ path }`.
- `consumePostLoginRedirect()` clears sessionStorage, publishes `{ path: null }`, returns the prior path.

Shared helpers live in `@shared/shell-events` (`publishPostLoginRedirectChanged`). Each shell `authActions.js` owns the storage key.

## PLP filters

| Direction | Topic | Event | Payload | Scope |
| --- | --- | --- | --- | --- |
| Ecommerce shell | `catalog` | `filters-changed` | `{ searchQuery, minPrice, maxPrice, categoryIds }` | `local` |

- `storePLPFilters` writes localStorage and publishes the snapshot.
- Bootstrap hydrates from localStorage, configures mesh, then publishes once so subscribers sync.

Remotes may use host-injected `subscribeToPlpFiltersChanges` from `localMeshEventBus.js` without importing the mesh client.

## Files

| Area | Path |
| --- | --- |
| Shared navigation contract | `packages/shell-events/src/shellEventContracts.js` |
| Shared publish API | `packages/shell-events/src/createShellEvents.js` |
| Ecommerce auth redirect | `apps/ecommerce-shell/src/utils/authActions.js` |
| Social auth redirect | `apps/social-media-shell/src/utils/authActions.js` |
| Admin auth redirect | `apps/admin-shell/src/utils/authActions.js` |
| Catalog contracts | `apps/ecommerce-shell/src/events/ecommerceEventContracts.js` |
| Catalog / shell bus | `apps/ecommerce-shell/src/events/localMeshEventBus.js` |
| PLP storage + publish | `apps/ecommerce-shell/src/utils/PLPFilterActions.js` |
| Order Details mount | `apps/ecommerce-shell/src/pages/orderPages.js` |
| Order Details token read | `apps/order-details/src/useOrderDetails.js` |

## Related docs

- Shell-local event overview: [notifications.md](./notifications.md)
- Mesh connection auth (no tokens in payloads): [mesh-authentication.md](./mesh-authentication.md)
