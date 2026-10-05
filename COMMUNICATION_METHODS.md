# Communication Methods Report

This report describes the mesh branch. The method column is the Event Mesh topic and event, with `scope` in parentheses. `local` stays inside the browser. `distributed` crosses the gateway.

Details for each mesh feature are in [MESH_IMPLEMENTATIONS/README.md](MESH_IMPLEMENTATIONS/README.md).

## 1. Events

### Shell and remote intents

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`navigate.js`, `main.js` auth guard) | Navigation | The shell should render again | `navigation.render-requested` (local) | Ecommerce Shell (`main.js` calls `renderApp()`) |
| Social Media Shell (`postsPage.js`, `main.js` after a new post) | Posts | The active page should refresh | `navigation.render-requested` (local) | Social Media Shell (`main.js` reloads the active single-spa page app) |
| Admin Shell (`navigate.js`, `main.js` auth guard) | Navigation | The shell should render again | `navigation.render-requested` (local) | Admin Shell (`main.js` calls `renderApp()`) |
| Ecommerce Shell (`authActions.js`) | Account | Auth state changed (login, logout, or profile refresh) | `auth.session-changed` (local) | Ecommerce Shell re-renders; header state is rebuilt from `appState` |
| Social Media Shell (`authActions.js`) | Account | Auth state changed (login, logout, or profile refresh) | `auth.session-changed` (local) | Social Media Shell reloads page apps; header state is rebuilt from `appState` |
| Admin Shell (`authActions.js`) | Account | Auth state changed (login, logout, or profile refresh) | `auth.session-changed` (local) | Admin Shell re-renders; header state is rebuilt from `appState` |
| Header (`header-element.js`) | Account | User clicked Log out | `auth.logout-requested` (local) | Ecommerce and Social Media Shells clear auth and navigate to `/`. Admin Shell navigates to `/login` |
| Header (`header-element.js`) | Navigation | User clicked a nav link: `{ path }` | `navigation.path-requested` (local) | Hosting shell (`main.js` calls `navigate(path)`) |
| Product Card (`product-card-component.js`) | Products | Open product details: `{ productId }` | `catalog.product-open-requested` (local) | Ecommerce Shell navigates to the PDP. Social Media Shell redirects to the ecommerce PDP |
| Product Card, Product Details (`product-details-adapter.ts`) | Cart | Item to add: `{ productId, quantity }` | `cart.item-add-requested` (local) | Ecommerce Shell adds the item and re-renders |
| Ecommerce Shell (`cartActions.js`, `placeCheckoutOrder.js`) | Cart | Cart snapshot: `{ items }` | `cart.changed` (local) | Ecommerce Shell and Checkout Items (`checkoutPage.js` via `subscribeToCartChanges`) |
| Checkout Items (`checkout-items.ts`) | Cart | Quantity change: `{ productId, quantity }` | `cart.item-update-requested` (local) | Ecommerce Shell updates the cart |
| Checkout Items (`checkout-items.ts`) | Cart | Item to remove: `{ productId }` | `cart.item-remove-requested` (local) | Ecommerce Shell removes the item |
| Product List Page (`ProductListView.js`) | Products | PLP filters to apply | `catalog.filters-apply-requested` (local) | Ecommerce Shell stores the filters and re-renders |
| Banners (`promotional-banner.js`) | Promotions | Promotion filters: `{ filters }` | `catalog.promotion-applied` (local) | Ecommerce Shell applies the filters. Social Media Shell redirects to the ecommerce PLP |
| Apply Coupon (`apply-coupon.ts`) | Checkout | Coupon code: `{ code }` | `checkout.coupon-applied` (local) | Ecommerce Shell stores the coupon |
| Checkout Summary (`checkout-summary.ts`) | Orders | Place the current cart | `checkout.place-order-requested` (local) | Ecommerce Shell (`placeCheckoutOrder.js`) posts the order |
| Account Profile (`account-profile.js`) | Account | Profile fields to save | `account.profile-save-requested` (local) | Hosting shell `accountCommands.js` calls `PUT /api/users/me` |
| Account Address (`account-address.js`) | Account | Address fields to save | `account.address-save-requested` (local) | Hosting shell `accountCommands.js` calls `PUT /api/users/me` |
| Post Feed (`post-feed.js`) | Posts | Post that was liked: `{ postId }` | `community.post-liked` (local) | Social Media Shell community listener |
| Post Feed (`post-feed.js`) | Posts | Author that was selected | `community.author-selected` (local) | Social Media Shell community listener |
| Ecommerce Shell (`notificationAdapter.js`) | Notifications | Toast: `{ type, title, message, durationMs? }` | `notifications.raised` (local) | Ecommerce Shell notification center. See [MESH_IMPLEMENTATIONS/notifications.md](MESH_IMPLEMENTATIONS/notifications.md) |
| Social Media Shell (`notificationAdapter.js`) | Notifications | Toast: `{ type, title, message, durationMs? }` | `notifications.raised` (local) | Social Media Shell notification center |
| Admin Shell (`notificationAdapter.js`) | Notifications | Toast: `{ type, title, message, durationMs? }` | `notifications.raised` (local) | Admin Shell notification center |
| Ecommerce Shell (`requestCsvExport.js`, account page) | Orders | Export request: `{ kind: "orders" }` | `exports.requested` (distributed) | Mock Data Service creates the job and replies `exports.completed` or `exports.failed`. See [MESH_IMPLEMENTATIONS/csv-exports.md](MESH_IMPLEMENTATIONS/csv-exports.md) |
| Social Media Shell (`requestCsvExport.js`, account page) | Posts | Export request: `{ kind: "posts" }` | `exports.requested` (distributed) | Mock Data Service creates the job and replies `exports.completed` or `exports.failed` |

`catalog.product-open-requested`, `catalog.filters-apply-requested`, `catalog.promotion-applied`, `cart.item-update-requested`, `cart.item-remove-requested`, `checkout.coupon-applied`, `checkout.place-order-requested`, the account save events, and the community like/author events have no window CustomEvent on `main`. On that branch they are host callbacks.

### Iframe boundary

The iframe page publishes `iframe-bridge.message` (distributed). The payload is `{ channelId, frameId, event, payload }`. `event` is the row below. See [MESH_IMPLEMENTATIONS/iframe-bridge.md](MESH_IMPLEMENTATIONS/iframe-bridge.md).

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Formulary iframe page (faq) | Layout | Content height: `{ height }` | `iframe-bridge.message` / `resized` (distributed) | Ecommerce Shell `homePage.js` resizes the iframe |
| Formulary iframe page (post) | Layout | Content height: `{ height }` | `iframe-bridge.message` / `resized` (distributed) | Formulary `new-post-formulary.js` resizes the iframe |
| Checkout Empty iframe page | Layout | Content height: `{ height }` | `iframe-bridge.message` / `resized` (distributed) | Checkout `checkout-empty.ts` resizes the iframe |
| Formulary iframe page (faq) | FAQ | Form submission: `{ name, email, contactMethod, question }` | `iframe-bridge.message` / `faq-submitted` (distributed) | Ecommerce Shell `homePage.js` persists the FAQ through `faqCommands.js` and publishes `navigation.render-requested`. The shared Formulary host also publishes `community.faq-submitted` (local) |
| Formulary iframe page (post) | Posts | Form submission: `{ content, imageUrl }` | `iframe-bridge.message` / `post-submitted` (distributed), then `community.post-submitted` (local) | Social Media Shell `main.js` persists the post through `postCommands.js` and publishes `navigation.render-requested` |
| Checkout Empty iframe page | Navigation | User clicked Go Back to Shopping | `iframe-bridge.message` / `go-shopping` (distributed) | Checkout `checkout-empty.ts` publishes `navigation.path-requested` for `/products` |

---

## 2. API-based

These HTTP calls stay HTTP on both branches until a later mesh branch replaces them.

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`loadData.js`, bootstrap) | Products | `GET /api/products` — full product catalog | HTTP → Mock Data Service | Ecommerce Shell (populates `appState.products` and `appState.productsById`) |
| Ecommerce Shell (`loadData.js`, bootstrap) | Promotions | `GET /api/showcases` — all showcase definitions | HTTP → Mock Data Service | Ecommerce Shell (populates `appState.showcases`) |
| Ecommerce Shell (`loadData.js`, bootstrap) | Promotions | `GET /api/banners` — all promotional banners | HTTP → Mock Data Service | Ecommerce Shell (populates `appState.banners`) |
| Social Media Shell (`loadData.js`, bootstrap) | Posts | `GET /api/posts` — all community posts | HTTP → Mock Data Service | Social Media Shell (populates `appState.posts`) |
| Social Media Shell (`loadData.js`, bootstrap) | Products | `GET /api/products` — product catalog for showcases | HTTP → Mock Data Service | Social Media Shell (populates `appState.products` and `appState.productsById`) |
| Social Media Shell (`loadData.js`, bootstrap) | Promotions | `GET /api/banners` — banners for interleaving with posts | HTTP → Mock Data Service | Social Media Shell (populates `appState.banners`) |
| Social Media Shell (`loadData.js`, bootstrap) | Promotions | `GET /api/showcases` — showcases for the feed page | HTTP → Mock Data Service | Social Media Shell (populates `appState.showcases`) |
| Product Card MFE | Products | `GET /api/products/:id` — single product by ID | HTTP → Mock Data Service | Product Card (renders product details when only `productId` is given) |
| Product Showcase MFE | Promotions | `GET /api/showcases/:id` — single showcase by ID | HTTP → Mock Data Service | Product Showcase (renders the showcase grid when only `showcaseId` is given) |
| Product List Page MFE | Products | `GET /api/products?search=X&minPrice=Y&maxPrice=Z&categoryIds=A,B&sort=field` — filtered products | HTTP → Mock Data Service | Product List Page (renders the filtered product grid) |
| Product List Page MFE | Products | `GET /api/categories` — all categories for the filter sidebar | HTTP → Mock Data Service | Product List Page (renders category filter checkboxes) |
| Product Details Page MFE | Products | `GET /api/products/:id` — full product details | HTTP → Mock Data Service | Product Details Page (renders the PDP view) |
| Banners MFE | Promotions | `GET /api/banners/:id` — single banner by ID | HTTP → Mock Data Service | Banners (renders the promotional banner when only `bannerId` is given) |
| Login MFE (`login-form.js`) | Account | `POST /api/auth/login` — `{ username, password }` → `{ token, user }` | HTTP → Mock Data Service | Login MFE writes the host storage keys, then publishes `auth.session-changed` (local) and `navigation.path-requested` (local) |
| Ecommerce, Social, and Admin Shells (`authActions.js`) | Account | `POST /api/auth/connection-ticket` — one-time WebSocket ticket | HTTP → Mock Data Service | Shell opens the authenticated mesh gateway. See [MESH_IMPLEMENTATIONS/mesh-authentication.md](MESH_IMPLEMENTATIONS/mesh-authentication.md) |
| Ecommerce Shell (`authActions.js`) | Account | `GET /api/users/me` — refresh current user | HTTP → Mock Data Service | Ecommerce Shell (updates `appState.currentUser`) |
| Social Media Shell (`authActions.js`) | Account | `GET /api/users/me` — refresh current user | HTTP → Mock Data Service | Social Media Shell (updates `appState.currentUser`) |
| Admin Shell (`authActions.js`) | Account | `GET /api/users/me` — refresh current user | HTTP → Mock Data Service | Admin Shell (updates `appState.currentUser`) |
| Ecommerce, Social, and Admin Shells (`accountCommands.js`) | Account | `PUT /api/users/me` — `{ fullName, username, address, ... }` | HTTP → Mock Data Service | Hosting shell updates `appState.currentUser` |
| Ecommerce Shell (`faqCommands.js`) | FAQ | `POST /api/faq` — `{ name, email, contactMethod, question }` | HTTP → Mock Data Service | Mock Data Service (stores the FAQ entry) |
| Social Media Shell (`postCommands.js`) | Posts | `POST /api/posts` — `{ content, imageUrl, authorId }` | HTTP → Mock Data Service | Social Media Shell (prepends the created post to `appState.posts`) |
| Ecommerce Shell (`accountPage.js`) | Orders | `GET /api/orders` — list the user's orders | HTTP → Mock Data Service | Ecommerce Shell (renders the order list on the account page) |
| Ecommerce Shell (`placeOrder.js`) | Orders | `POST /api/orders` — `{ items, subtotal, discountAmount, totalAmount, appliedCoupon, shippingAddress }` | HTTP → Mock Data Service | Mock Data Service (stores the order) |
| Admin Shell (`ordersPage.js`, `dashboardPage.js`) | Orders | `GET /api/admin/orders` — all orders | HTTP → Mock Data Service | Admin Shell (renders the orders list and dashboard counts) |
| Admin Shell (`postsPage.js`, `dashboardPage.js`) | Posts | `GET /api/admin/posts` — all posts | HTTP → Mock Data Service | Admin Shell (renders the posts list and dashboard counts) |
| Ecommerce or Social Shell (`requestCsvExport.js`) | Orders / Posts | `GET /api/exports/:requestId/download` — finished CSV bytes | HTTP → Mock Data Service | Browser downloads the file after `exports.completed`. See [MESH_IMPLEMENTATIONS/csv-exports.md](MESH_IMPLEMENTATIONS/csv-exports.md) |
| Order Details MFE (`useOrderDetails.js`) | Orders | `GET /api/orders/:id` — single order details | HTTP → Mock Data Service | Order Details MFE (renders the full order view) |

---

## 3. Web Storage

These keys are the reload cache. Live coordination is described in [MESH_IMPLEMENTATIONS/storage-coordination.md](MESH_IMPLEMENTATIONS/storage-coordination.md).

### localStorage

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`authActions.js`) | Account | Auth token (JWT string) | Write to `ecommerce-shell:auth-token` | Ecommerce Shell reads it on bootstrap |
| Ecommerce Shell (`authActions.js`) | Account | User object (JSON) | Write to `ecommerce-shell:auth-user` | Ecommerce Shell reads it on bootstrap |
| Ecommerce Shell (`PLPFilterActions.js`) | Products | PLP filters (JSON: `{ searchQuery, minPrice, maxPrice, categoryIds }`) | Write to `ecommerce-shell:plp-filters` | Ecommerce Shell reads it on bootstrap. Changes also publish `catalog` filter coordination described in the storage note |
| Social Media Shell (`authActions.js`) | Account | Auth token (JWT string) | Write to `social-media-shell:auth-token` | Social Media Shell reads it on bootstrap |
| Social Media Shell (`authActions.js`) | Account | User object (JSON) | Write to `social-media-shell:auth-user` | Social Media Shell reads it on bootstrap |
| Admin Shell (`authActions.js`) | Account | Auth token (JWT string) | Write to `admin-shell:auth-token` | Admin Shell reads it on bootstrap |
| Admin Shell (`authActions.js`) | Account | User object (JSON) | Write to `admin-shell:auth-user` | Admin Shell reads it on bootstrap |

### sessionStorage

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`authActions.js`) | Navigation | Post-login redirect path | Write to `ecommerce-shell:post-login-redirect` | Ecommerce Shell consumes it after login. The shell also publishes `navigation.post-login-redirect-changed` (local) |
| Social Media Shell (`authActions.js`) | Navigation | Post-login redirect path | Write to `social-media-shell:post-login-redirect` | Social Media Shell consumes it after login, and publishes `navigation.post-login-redirect-changed` (local) |
| Admin Shell (`authActions.js`) | Navigation | Post-login redirect path | Write to `admin-shell:post-login-redirect` | Admin Shell consumes it after login, and publishes `navigation.post-login-redirect-changed` (local) |

---

## 4. Global State

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`cartActions.js`, `main.js`, `placeCheckoutOrder.js`) | Cart | Full cart array: `[{ productId, quantity }, ...]` | `cart.changed` (local), payload `{ items }` | Checkout Items subscribes through `subscribeToCartChanges` in `checkoutPage.js` |

---

## 5. Query Params

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Product Details Page MFE | Products | `?productId=X` — which product to display | URL query param on the `/product` route | Product Details Page MFE reads it from `window.location.search` |
| Order Details MFE (`useOrderDetails.js`) | Orders | `orderId` path segment (`/order-details/{orderId}`) | URL path param | Order Details MFE parses it from `window.location.pathname` |
| Social Media Shell (`postsPage.js`) → Ecommerce Shell | Products | `?searchQuery=X&minPrice=Y&maxPrice=Z&categoryIds=A,B` | URL query params on a cross-shell redirect to `/products` | Ecommerce Shell reads them on PLP load |
| Social Media Shell (`feedPage.js`) → Ecommerce Shell | Products | `?productId=X` | URL query param on a cross-shell redirect to `/product` | Product Details Page MFE reads it from `window.location.search` |
| Formulary and Checkout iframe hosts | FAQ / Posts / Checkout | `type`, `name`, `email`, `authorId`, `channelId`, `frameId` | Query params on the iframe `src` URL | Iframe page joins the `iframe-bridge` channel |
| Product List Page MFE | Products | `?search=X&minPrice=Y&maxPrice=Z&categoryIds=A,B&sort=field` | Query params on the API request URL | Mock Data Service filters and sorts the product response |

---

## 6. URL Changes

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`navigate.js`) | Navigation | New route path (for example `/products`, `/checkout`, `/login`) | `history.pushState` plus `navigation.render-requested` (local) | Ecommerce Shell re-renders the page for the new route |
| Ecommerce Shell (`main.js` auth guard) | Account | Redirect to `/login` when a protected route is opened | `history.replaceState` | Ecommerce Shell renders the login page |
| Social Media Shell (`navigate.js`) | Navigation | New route path (for example `/posts`, `/login`, `/account`) | single-spa `navigateToUrl` | Social Media Shell mounts and unmounts page apps from `activeWhen` |
| Social Media Shell (`main.js` auth guard) | Account | Redirect to `/login` when a protected route is opened | `history.replaceState` | Social Media Shell activates the login page app |
| Admin Shell (`navigate.js`) | Navigation | New route path (for example `/orders`, `/posts`, `/account`) | `history.pushState` plus `navigation.render-requested` (local) | Admin Shell re-renders the page for the new route |
| Admin Shell (`main.js` auth guard) | Account | Redirect to `/login` without an admin session | `history.replaceState` | Admin Shell renders the login page |
| Social Media Shell (`feedPage.js`) | Products | Cross-shell redirect: `http://localhost:4200/product?productId=X` | `window.location.assign()` | Ecommerce Shell loads product details |
| Social Media Shell (`postsPage.js`) | Promotions | Cross-shell redirect: `http://localhost:4200/products?...` | `window.location.href` | Ecommerce Shell loads the filtered PLP |
| Browser (back/forward button) | Navigation | Previous or next history entry | `popstate` | Ecommerce Shell and Admin Shell re-render. Social Media Shell follows the URL through single-spa |

---

## 7. Communication Methods per App

| App / Component | Events | API-based | Web Storage | Global State | Query Params | URL Changes |
|---|---|---|---|---|---|---|
| **Ecommerce Shell** | `navigation.render-requested`, `navigation.path-requested`, `auth.session-changed`, `auth.logout-requested`, `cart.item-add-requested`, `cart.changed`, `notifications.raised`, `exports.requested` | Catalog bootstrap, account, FAQ, orders, connection ticket, export download | localStorage (3 keys) + sessionStorage (1 key) | Publishes `cart.changed` (local) | Builds `productId` query params for navigation | `pushState`, `replaceState` |
| **Social Media Shell** | `navigation.render-requested`, `navigation.path-requested`, `auth.session-changed`, `auth.logout-requested`, `notifications.raised`, `exports.requested`, `community.post-submitted` | Catalog and posts bootstrap, account, create post, connection ticket, export download | localStorage (2 keys) + sessionStorage (1 key) | -- | Builds cross-shell query params | `navigateToUrl`, `replaceState`, `location.assign`, `location.href` |
| **Admin Shell** | `navigation.render-requested`, `navigation.path-requested`, `auth.session-changed`, `auth.logout-requested`, `notifications.raised` | Account refresh and update, `GET /api/admin/orders`, `GET /api/admin/posts`, connection ticket | localStorage (2 keys) + sessionStorage (1 key) | -- | -- | `pushState`, `replaceState` |
| **Header** | Publishes `navigation.path-requested`, `auth.logout-requested` | -- | -- | -- | -- | -- |
| **Footer** | -- | -- | -- | -- | -- | -- |
| **Product Card** | Publishes `catalog.product-open-requested`, `cart.item-add-requested` | `GET /products/:id` | -- | -- | -- | -- |
| **Product Showcase** | -- | `GET /showcases/:id` | -- | -- | -- | -- |
| **Product List Page** | Publishes `catalog.filters-apply-requested` | `GET /products?...`, `GET /categories` | -- | -- | Builds API query params | -- |
| **Product Details Page** | Publishes `cart.item-add-requested` | `GET /products/:id` | -- | -- | Reads `productId` from `window.location.search` | -- |
| **Banners** | Publishes `catalog.promotion-applied` | `GET /banners/:id` | -- | -- | -- | -- |
| **Formulary (iframe)** | `iframe-bridge.message` / `resized`, `faq-submitted`, `post-submitted`; hosts publish `community.faq-submitted` and `community.post-submitted` | -- | -- | -- | Reads `type`, `name`, `email`, `authorId`, `channelId`, `frameId` | -- |
| **Checkout Empty (iframe)** | `iframe-bridge.message` / `resized`, `go-shopping`; host publishes `navigation.path-requested` | -- | -- | -- | Reads `channelId`, `frameId` | -- |
| **Checkout Items/Summary/Coupon** | Publishes `cart.item-update-requested`, `cart.item-remove-requested`, `checkout.coupon-applied`, `checkout.place-order-requested` | -- | -- | Checkout Items subscribes to `cart.changed` | -- | -- |
| **Login** | Writes host auth keys; publishes `auth.session-changed` and `navigation.path-requested` | `POST /auth/login` | Host-injected token and user keys | -- | -- | -- |
| **Account** | Publishes `account.profile-save-requested`, `account.address-save-requested` | -- | -- | -- | -- | -- |
| **Order Details** | -- | `GET /orders/:id` | Host-injected `getAuthToken` | -- | Reads `orderId` from `window.location.pathname` | -- |
| **Post Feed** | Publishes `community.post-liked`, `community.author-selected` | -- | -- | -- | -- | -- |
| **Mock Data Service** | Replies `exports.completed` / `exports.failed`; relays `iframe-bridge` | Serves the API endpoints above | -- | -- | Reads filter and sort query params | -- |

---

## 8. Baseline to mesh map

One row per baseline channel on `main`. The mesh column is the topic and event used on this branch.

| Baseline (`main`) | Mesh |
|---|---|
| `global:renderApp` | `navigation.render-requested` (local) |
| `auth:changed` | `auth.session-changed` (local) |
| `auth:logout-request` | `auth.logout-requested` (local) |
| `host:logout` | `auth.logout-requested` (local), published by the header through the shell bus |
| `host:navigate` | `navigation.path-requested` (local) |
| `cart:add-item` | `cart.item-add-requested` (local) |
| `cart:updateGlobalCart` | `cart.changed` (local) |
| `ecommerce-shell:notification` | `notifications.raised` (local) |
| `social-media-shell:notification` | `notifications.raised` (local) |
| `admin-shell:notification` | `notifications.raised` (local) |
| `iframe:resize` | `iframe-bridge.message` / `resized` (distributed) |
| `faq:form-submitted` | `iframe-bridge.message` / `faq-submitted` (distributed) |
| `post:form-submitted` | `iframe-bridge.message` / `post-submitted` (distributed), then `community.post-submitted` |
| `checkout:go-shopping` | `iframe-bridge.message` / `go-shopping` (distributed) |
| Storage keys `ecommerce-shell:auth-token`, `ecommerce-shell:auth-user`, `ecommerce-shell:plp-filters`, `ecommerce-shell:post-login-redirect`, `social-media-shell:auth-token`, `social-media-shell:auth-user`, `social-media-shell:post-login-redirect`, `admin-shell:auth-token`, `admin-shell:auth-user`, `admin-shell:post-login-redirect` | Same keys, used as the reload cache, plus the events in [MESH_IMPLEMENTATIONS/storage-coordination.md](MESH_IMPLEMENTATIONS/storage-coordination.md) |

Further notes on this branch:

- [MESH_IMPLEMENTATIONS/notifications.md](MESH_IMPLEMENTATIONS/notifications.md)
- [MESH_IMPLEMENTATIONS/iframe-bridge.md](MESH_IMPLEMENTATIONS/iframe-bridge.md)
- [MESH_IMPLEMENTATIONS/remote-intents.md](MESH_IMPLEMENTATIONS/remote-intents.md)
- [MESH_IMPLEMENTATIONS/storage-coordination.md](MESH_IMPLEMENTATIONS/storage-coordination.md)
- [MESH_IMPLEMENTATIONS/csv-exports.md](MESH_IMPLEMENTATIONS/csv-exports.md)
- [MESH_IMPLEMENTATIONS/mesh-authentication.md](MESH_IMPLEMENTATIONS/mesh-authentication.md)
