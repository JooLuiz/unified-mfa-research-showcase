# Communication Methods Report

## 1. Events

Shell-local UI coordination and product remote intents use **Event Mesh** (`scope: "local"`), not window CustomEvents. See `MESH_IMPLEMENTATIONS/notifications.md` and `MESH_IMPLEMENTATIONS/remote-intents.md`.

### Local Event Mesh (product remotes)

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Product Card | Products | Open product details: `{ productId }` | `catalog.product-open-requested` | Ecommerce navigates to PDP; Social hard-redirects to ecommerce PDP. Social “See More” explicitly uses this intent. |
| Product Card / Product Details | Cart | Add item: `{ productId, quantity }` | `cart.item-add-requested` | Ecommerce mutates cart + toast. Product Card publishes it when `actionIntent` is `add-to-cart`. |

### Distributed Event Mesh (iframe boundary)

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Formulary iframe page (type=faq) | Layout | Content height for auto-sizing: `{ height }` | `iframe-bridge.message` / `resized`, distributed scope | Ecommerce Shell channel subscription resizes the iframe element |
| Formulary iframe page (type=post) | Layout | Content height for auto-sizing: `{ height }` | `iframe-bridge.message` / `resized`, distributed scope | Formulary `mountNewPostFormulary` channel subscription resizes the iframe element |
| Checkout Empty iframe page | Layout | Content height for auto-sizing: `{ height }` | `iframe-bridge.message` / `resized`, distributed scope | Checkout `mountCheckoutEmpty` channel subscription resizes the iframe element |
| Formulary iframe page (type=faq) | FAQ | Form submission: `{ name, email, contactMethod, question }` | `iframe-bridge.message` / `faq-submitted`, distributed scope | Ecommerce Shell persists to API and re-renders |
| Formulary iframe page (type=post) | Posts | Form submission: `{ content, imageUrl }` | `iframe-bridge.message` / `post-submitted` → mount publishes `community.post-submitted` (local) | Social Media Shell mesh handler persists to API and reloads page |
| Checkout Empty iframe page | Cart / Navigation | User clicked "Go Back to Shopping" | `iframe-bridge.message` / `go-shopping`, distributed scope | Ecommerce Shell navigates to `/products` |

---

## 2. API-based

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`loadData.js`, bootstrap) | Products | `GET /api/products` — full product catalog | HTTP → Mock Data Service | Ecommerce Shell (populates `appState.products` and `appState.productsById`) |
| Ecommerce Shell (`loadData.js`, bootstrap) | Promotions | `GET /api/showcases` — all showcase definitions | HTTP → Mock Data Service | Ecommerce Shell (populates `appState.showcases`) |
| Ecommerce Shell (`loadData.js`, bootstrap) | Promotions | `GET /api/banners` — all promotional banners | HTTP → Mock Data Service | Ecommerce Shell (populates `appState.banners`) |
| Social Media Shell (`loadData.js`, bootstrap) | Posts | `GET /api/posts` — all community posts | HTTP → Mock Data Service | Social Media Shell (populates `appState.posts`) |
| Social Media Shell (`loadData.js`, bootstrap) | Products | `GET /api/products` — product catalog for showcases | HTTP → Mock Data Service | Social Media Shell (populates `appState.products` and `appState.productsById`) |
| Social Media Shell (`loadData.js`, bootstrap) | Promotions | `GET /api/banners` — banners for interleaving with posts | HTTP → Mock Data Service | Social Media Shell (populates `appState.banners`) |
| Social Media Shell (`loadData.js`, bootstrap) | Promotions | `GET /api/showcases` — showcases for feed page | HTTP → Mock Data Service | Social Media Shell (populates `appState.showcases`) |
| Product Card MFE | Products | `GET /api/products/:id` — single product by ID | HTTP → Mock Data Service | Product Card (renders product details when no `product` prop given, only `productId`) |
| Product Showcase MFE | Promotions | `GET /api/showcases/:id` — single showcase by ID | HTTP → Mock Data Service | Product Showcase (renders showcase grid when only `showcaseId` is given) |
| Product List Page MFE | Products | `GET /api/products?search=X&minPrice=Y&maxPrice=Z&categoryIds=A,B&sort=field` — filtered products | HTTP → Mock Data Service | Product List Page (renders filtered product grid) |
| Product List Page MFE | Products | `GET /api/categories` — all categories for filter sidebar | HTTP → Mock Data Service | Product List Page (renders category filter checkboxes) |
| Product Details Page MFE | Products | `GET /api/products/:id` — full product details | HTTP → Mock Data Service | Product Details Page (renders PDP view) |
| Banners MFE | Promotions | `GET /api/banners/:id` — single banner by ID | HTTP → Mock Data Service | Banners (renders promotional banner when only `bannerId` is given) |
| Login MFE | Account | `POST /api/auth/login` — credentials → `{ token, user }` | HTTP → Mock Data Service; then write host auth keys + `auth.session-changed` / `navigation.path-requested` (no JWT on mesh) | Owning shell hydrates via `readStoredAuth` and navigates |
| Ecommerce Shell (`authActions.js`) | Account | `GET /api/users/me` — refresh current user | HTTP → Mock Data Service | Ecommerce Shell (updates `appState.currentUser`) |
| Social Media Shell (`authActions.js`) | Account | `GET /api/users/me` — refresh current user | HTTP → Mock Data Service | Social Media Shell (updates `appState.currentUser`) |
| Ecommerce Shell (`renderActions.js`) | Account | `PUT /api/users/me` — `{ fullName, username, address, ... }` | HTTP → Mock Data Service | Ecommerce Shell (updates `appState.currentUser` with response) |
| Social Media Shell (`renderActions.js`) | Account | `PUT /api/users/me` — `{ fullName, username, address, ... }` | HTTP → Mock Data Service | Social Media Shell (updates `appState.currentUser` with response) |
| Ecommerce Shell (`renderActions.js`) | FAQ | `POST /api/faq` — `{ name, email, contactMethod, question }` | HTTP → Mock Data Service | Mock Data Service (stores FAQ entry) |
| Social Media Shell (`renderActions.js`) | Posts | `POST /api/posts` — `{ content, imageUrl, authorId }` | HTTP → Mock Data Service | Social Media Shell (prepends created post to `appState.posts`) |
| Ecommerce Shell (`renderActions.js`) | Orders | `GET /api/orders` — list user's orders | HTTP → Mock Data Service | Ecommerce Shell (renders order list in account page) |
| Ecommerce Shell (`renderActions.js`) | Orders | `POST /api/orders` — `{ items, subtotal, discountAmount, totalAmount, appliedCoupon, shippingAddress }` | HTTP → Mock Data Service | Mock Data Service (stores order) |
| Order Details MFE | Orders | `GET /api/orders/:id` — single order details | HTTP → Mock Data Service | Order Details MFE (renders full order view) |

---

## 3. Web Storage

Web storage is a **reload/tab cache**. Live coordination for redirects and PLP filters uses local Event Mesh (`scope: "local"`); see `MESH_IMPLEMENTATIONS/storage-coordination.md`. Order Details receives auth via host-injected `getAuthToken` and does not read shell localStorage.

### localStorage

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`authActions.js`) | Account | Auth token (JWT string) | Write to `ecommerce-shell:auth-token` | Ecommerce Shell (`authActions.js` reads on bootstrap to restore session; mesh ticket bootstrap) |
| Ecommerce Shell (`authActions.js`) | Account | User object (JSON: id, username, fullName, email, address) | Write to `ecommerce-shell:auth-user` | Ecommerce Shell (`authActions.js` reads on bootstrap) |
| Ecommerce Shell (`PLPFilterActions.js`) | Products | PLP filters (JSON: `{ searchQuery, minPrice, maxPrice, categoryIds }`) | Write to `ecommerce-shell:plp-filters` + publish `catalog.filters-changed` | Ecommerce Shell (hydrate on bootstrap; mesh subscribers for live sync) |
| Social Media Shell (`authActions.js`) | Account | Auth token (JWT string) | Write to `social-media-shell:auth-token` | Social Media Shell (`authActions.js` reads on bootstrap) |
| Social Media Shell (`authActions.js`) | Account | User object (JSON: id, username, fullName, email, address) | Write to `social-media-shell:auth-user` | Social Media Shell (`authActions.js` reads on bootstrap) |
| Admin Shell (`authActions.js`) | Account | Auth token (JWT string) | Write to `admin-shell:auth-token` | Admin Shell (`authActions.js` reads on bootstrap) |
| Admin Shell (`authActions.js`) | Account | User object (JSON) | Write to `admin-shell:auth-user` | Admin Shell (`authActions.js` reads on bootstrap) |

### sessionStorage

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`authActions.js`) | Navigation | Intended post-login redirect path | Write to `ecommerce-shell:post-login-redirect` + publish `navigation.post-login-redirect-changed` | Ecommerce Shell (consume after login) |
| Social Media Shell (`authActions.js`) | Navigation | Intended post-login redirect path | Write to `social-media-shell:post-login-redirect` + publish `navigation.post-login-redirect-changed` | Social Media Shell (consume after login) |
| Admin Shell (`authActions.js`) | Navigation | Intended post-login redirect path | Write to `admin-shell:post-login-redirect` + publish `navigation.post-login-redirect-changed` | Admin Shell (consume after login) |

---

## 4. Global State

Cart snapshots are coordinated over local Event Mesh (`cart.changed`), not `window` globals. See [MESH_IMPLEMENTATIONS/remote-intents.md](./MESH_IMPLEMENTATIONS/remote-intents.md).

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`localMeshEventBus.js`) | Cart | Full cart array: `[{ productId, quantity }, ...]` | Publish `cart.changed` (local scope); host injects `subscribeToCartChanges` | Checkout Items MFE refreshes lines; header updates via shell listener |

---

## 5. Query Params

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Product Details Page MFE (`product-details.ts`) | Products | `?productId=X` — which product to display | URL query param on `/product` route | Product Details Page MFE reads it from `window.location.search` to fetch and render product |
| Order Details MFE (`order-details.js`) | Orders | `orderId` path param (`/order-details/{orderId}`) — which order to display | URL path param on `/order-details/{orderId}` route | Order Details MFE parses it from `window.location.pathname` to fetch and render order |
| Social Media Shell → Ecommerce Shell | Products | `?searchQuery=X&minPrice=Y&maxPrice=Z&categoryIds=A,B` — promotional filters | URL query params on cross-shell redirect to `/products` | Ecommerce Shell (reads these on PLP page load via PLPFilterActions or URL) |
| Social Media Shell → Ecommerce Shell | Products | `?productId=X` — product to view | URL query param on cross-shell redirect to `/product` | Product Details Page MFE reads it from `window.location.search` |
| Formulary mount function (internal) | FAQ / Posts | `?type=faq&name=X&email=Y` or `?type=post&name=X&email=Y&authorId=Z` | Query params on iframe src URL | Formulary iframe page (reads params for form autofill and form-type selection) |
| Product List Page MFE (internal) | Products | `?search=X&minPrice=Y&maxPrice=Z&categoryIds=A,B&sort=field` | Query params on API request URL | Mock Data Service (filters and sorts product response) |

---

## 6. URL Changes

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`navigate.js`) | Navigation | New route path (e.g. `/products`, `/checkout`, `/login`) | `history.pushState` + `global:renderApp` event | Ecommerce Shell (re-renders the page for the new route) |
| Ecommerce Shell (`main.js` auth guard) | Account | Redirect to `/login` when accessing protected route | `history.replaceState` | Ecommerce Shell (renders login page instead of target) |
| Social Media Shell (`navigate.js`) | Navigation | New route path (e.g. `/posts`, `/login`, `/account`) | single-spa `navigateToUrl` | Social Media Shell (single-spa mounts/unmounts page apps based on `activeWhen`) |
| Social Media Shell (`main.js` auth guard) | Account | Redirect to `/login` when accessing protected route | `history.replaceState` | Social Media Shell (login page app activates) |
| Social Media Shell (`renderActions.js`) | Products | Cross-shell redirect: `http://localhost:4200/product?productId=X` | `window.location.assign()` | Ecommerce Shell (full page load at product details) |
| Social Media Shell (`renderActions.js`) | Promotions | Cross-shell redirect: `http://localhost:4200/products?filters...` | `window.location.href =` | Ecommerce Shell (full page load at filtered PLP) |
| Browser (back/forward button) | Navigation | Previous/next history entry | `popstate` event | Both shells (re-render for the restored URL) |

---

## Communication Methods per App (Summary Matrix)

| App / Component | Events | API-based | Web Storage | Global State | Query Params | URL Changes |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Ecommerce Shell** | Dispatches & listens to mesh intents (catalog/cart/checkout/shell) | 9 API interactions | localStorage (3 keys) + sessionStorage (1 key) | Publishes `cart.changed` snapshots | Builds `productId` query params for navigation; does not parse ids for MFEs | `pushState`, `replaceState` |
| **Social Media Shell** | Dispatches & listens to 4 event types | 7 API interactions | localStorage (2 keys) + sessionStorage (1 key) | -- | Builds cross-shell query params | `navigateToUrl`, `replaceState`, `location.assign/href` |
| **Header** | Dispatches `host:navigate`, `host:logout` | -- | -- | -- | -- | -- |
| **Footer** | -- | -- | -- | -- | -- | -- |
| **Product Card** | Publishes `catalog.product-open-requested` / `cart.item-add-requested` | `GET /products/:id` | -- | -- | -- | -- |
| **Product Showcase** | -- | `GET /showcases/:id` | -- | -- | -- | -- |
| **Product List Page** | Publishes `catalog.filters-apply-requested` | `GET /products?...`, `GET /categories` | -- | -- | Builds API query params | -- |
| **Product Details Page** | Publishes `cart.item-add-requested` | `GET /products/:id` | -- | -- | Reads `productId` from `window.location.search` | -- |
| **Banners** | Publishes `catalog.promotion-applied` | `GET /banners/:id` | -- | -- | -- | -- |
| **Formulary (iframe)** | Bridge resize; mounts publish `community.post-submitted` / `community.faq-submitted` | -- | -- | -- | Reads `type`, `name`, `email`, `authorId`, and an opaque bridge channel from URL | -- |
| **Checkout Empty (iframe)** | Distributed Event Mesh bridge (resize + go-shopping) → host publishes `navigation.path-requested` | -- | -- | -- | Reads an opaque bridge channel from URL | -- |
| **Checkout Items/Summary/Coupon** | Publishes cart update/remove, `checkout.coupon-applied`, `checkout.place-order-requested` | -- | -- | Checkout Items receives cart via host `subscribeToCartChanges` | -- | -- |
| **Login** | Writes shell auth keys; publishes `auth.session-changed` + `navigation.path-requested` | `POST /auth/login` | Host-injected token/user keys | -- | -- | -- |
| **Account** | Publishes `account.profile-save-requested` / `account.address-save-requested` | -- | -- | -- | -- | -- |
| **Order Details** | -- | `GET /orders/:id` | -- (host-injected `getAuthToken`) | -- | Reads `orderId` from `window.location.pathname` | -- |
| **Post Feed** | Publishes `community.post-liked` / `community.author-selected` | -- | -- | -- | -- | -- |
| **Mock Data Service** | -- | Serves all API endpoints | -- | -- | Reads filter/sort query params | -- |
