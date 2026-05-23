# Communication Methods Report

## 1. Events

### Window-level CustomEvents

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`navigate.js`) | Navigation | A route change occurred, app needs re-render | `global:renderApp` event | Ecommerce Shell (`main.js` calls `renderApp()`) |
| Social Media Shell (`renderActions.js`) | Posts | A new post was created, page needs refresh | `global:renderApp` event | Social Media Shell (`main.js` reloads single-spa page app) |
| Ecommerce Shell (`authActions.js`) | Account | Auth state changed (login, logout, or profile refresh) | `auth:changed` event | Ecommerce Shell (`main.js` re-renders app) |
| Social Media Shell (`authActions.js`) | Account | Auth state changed (login, logout, or profile refresh) | `auth:changed` event | Social Media Shell (`main.js` reloads page apps), Header (updates its displayed state) |
| Ecommerce Shell (`mountActions.js`, on header `host:logout`) | Account | User requested logout | `auth:logout-request` event | Ecommerce Shell (`main.js` clears auth, navigates to `/`) |
| Social Media Shell (`mountActions.js`, on header `host:logout`) | Account | User requested logout | `auth:logout-request` event | Social Media Shell (`main.js` clears auth, navigates to `/`) |
| Ecommerce Shell (`cartActions.js` via Product Card, Product Details, Product Showcase) | Cart | Item to add: `{ productId, quantity }` | `cart:add-item` event | Ecommerce Shell (`main.js` adds item to `appState.cartItems`, re-renders) |
| Ecommerce Shell (`cartActions.js`) | Cart | Cart contents were modified (update/remove/order placed) | `cart:updateGlobalCart` event | Ecommerce Shell (`main.js` syncs `window.__APP_SHELL_CART__`) |

### Element-level CustomEvents (Web Component boundary)

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Header (web component) | Navigation | User clicked a nav link: `{ path }` | `host:navigate` CustomEvent on element | Ecommerce Shell or Social Media Shell (whichever hosts the header; calls `navigate(path)`) |
| Header (web component) | Account | User clicked "Log out" | `host:logout` CustomEvent on element | Ecommerce Shell or Social Media Shell (dispatches `auth:logout-request`) |

### postMessage (iframe boundary)

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Formulary iframe page (type=faq) | Layout | Content height for auto-sizing: `{ frameId: "faq-formulary", height }` | `iframe:resize` postMessage | Formulary `mountFaqFormulary` function (resizes the iframe element) |
| Formulary iframe page (type=post) | Layout | Content height for auto-sizing: `{ frameId: "new-post-formulary", height }` | `iframe:resize` postMessage | Formulary `mountNewPostFormulary` function (resizes the iframe element) |
| Checkout Empty iframe page | Layout | Content height for auto-sizing: `{ frameId: "checkout-empty", height }` | `iframe:resize` postMessage | Checkout `mountCheckoutEmpty` function (resizes the iframe element) |
| Formulary iframe page (type=faq) | FAQ | Form submission: `{ name, email, contactMethod, question }` | `faq:form-submitted` postMessage | Formulary `mountFaqFormulary` → invokes `onFormSubmitted` callback → Ecommerce Shell persists to API and re-renders |
| Formulary iframe page (type=post) | Posts | Form submission: `{ content, imageUrl }` | `post:form-submitted` postMessage | Formulary `mountNewPostFormulary` → invokes `onFormSubmitted` callback → Social Media Shell persists to API and reloads page |
| Checkout Empty iframe page | Cart / Navigation | User clicked "Go Back to Shopping" | `checkout:go-shopping` postMessage | Checkout `mountCheckoutEmpty` → invokes `onGoShopping` callback → Ecommerce Shell navigates to `/products` |

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
| Login MFE | Account | `POST /api/auth/login` — `{ email, password }` → `{ token, user }` | HTTP → Mock Data Service | Login MFE (returns credentials to shell via `onLoginSuccess` callback) |
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

### localStorage

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`authActions.js`) | Account | Auth token (JWT string) | Write to `ecommerce-shell:auth-token` | Ecommerce Shell (`authActions.js` reads on bootstrap to restore session) |
| Ecommerce Shell (`authActions.js`) | Account | User object (JSON: id, username, fullName, email, address) | Write to `ecommerce-shell:auth-user` | Ecommerce Shell (`authActions.js` reads on bootstrap) |
| Ecommerce Shell (`PLPFilterActions.js`) | Products | PLP filters (JSON: `{ searchQuery, minPrice, maxPrice, categoryIds }`) | Write to `ecommerce-shell:plp-filters` | Ecommerce Shell (`PLPFilterActions.js` reads on bootstrap to restore last-used filters) |
| Social Media Shell (`authActions.js`) | Account | Auth token (JWT string) | Write to `social-media-shell:auth-token` | Social Media Shell (`authActions.js` reads on bootstrap) |
| Social Media Shell (`authActions.js`) | Account | User object (JSON: id, username, fullName, email, address) | Write to `social-media-shell:auth-user` | Social Media Shell (`authActions.js` reads on bootstrap) |

### sessionStorage

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`authActions.js`) | Navigation | Intended post-login redirect path (e.g. `/checkout`, `/account`) | Write to `ecommerce-shell:post-login-redirect` | Ecommerce Shell (`authActions.js` reads and consumes after successful login) |
| Social Media Shell (`authActions.js`) | Navigation | Intended post-login redirect path (e.g. `/account`, `/posts`) | Write to `social-media-shell:post-login-redirect` | Social Media Shell (`authActions.js` reads and consumes after successful login) |

---

## 4. Global State

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`main.js`) | Cart | Full cart array: `[{ productId, quantity }, ...]` | Write to `window.__APP_SHELL_CART__` | Any MFE running inside the ecommerce shell that reads this global (currently no observed reader — likely an escape hatch for future integrations) |

---

## 5. Query Params

| Triggering App | Entity | What Is Communicated | Method | Affected App(s) |
|---|---|---|---|---|
| Ecommerce Shell (`renderActions.js`) | Products | `?productId=X` — which product to display | URL query param on `/product` route | Ecommerce Shell reads it and passes `productId` to Product Details Page MFE |
| Ecommerce Shell (`renderActions.js`) | Orders | `?orderId=X` — which order to display | URL query param on `/order-details` route | Ecommerce Shell reads it and passes `orderId` to Order Details MFE |
| Social Media Shell → Ecommerce Shell | Products | `?searchQuery=X&minPrice=Y&maxPrice=Z&categoryIds=A,B` — promotional filters | URL query params on cross-shell redirect to `/products` | Ecommerce Shell (reads these on PLP page load via PLPFilterActions or URL) |
| Social Media Shell → Ecommerce Shell | Products | `?productId=X` — product to view | URL query param on cross-shell redirect to `/product` | Ecommerce Shell (reads it for Product Details Page) |
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
| **Ecommerce Shell** | Dispatches & listens to 6 event types | 9 API interactions | localStorage (3 keys) + sessionStorage (1 key) | Writes `window.__APP_SHELL_CART__` | Reads `productId`, `orderId` | `pushState`, `replaceState` |
| **Social Media Shell** | Dispatches & listens to 4 event types | 7 API interactions | localStorage (2 keys) + sessionStorage (1 key) | -- | Builds cross-shell query params | `navigateToUrl`, `replaceState`, `location.assign/href` |
| **Header** | Dispatches `host:navigate`, `host:logout` | -- | -- | -- | -- | -- |
| **Footer** | -- | -- | -- | -- | -- | -- |
| **Product Card** | -- | `GET /products/:id` | -- | -- | -- | -- |
| **Product Showcase** | -- | `GET /showcases/:id` | -- | -- | -- | -- |
| **Product List Page** | -- | `GET /products?...`, `GET /categories` | -- | -- | Builds API query params | -- |
| **Product Details Page** | -- | `GET /products/:id` | -- | -- | -- | -- |
| **Banners** | -- | `GET /banners/:id` | -- | -- | -- | -- |
| **Formulary (iframe)** | postMessage (resize + form-submitted) | -- | -- | -- | Reads `type`, `name`, `email`, `authorId` from URL | -- |
| **Checkout Empty (iframe)** | postMessage (resize + go-shopping) | -- | -- | -- | -- | -- |
| **Checkout Items/Summary/Coupon** | -- | -- | -- | -- | -- | -- |
| **Login** | -- | `POST /auth/login` | -- | -- | -- | -- |
| **Account** | -- | -- | -- | -- | -- | -- |
| **Order Details** | -- | `GET /orders/:id` | -- | -- | -- | -- |
| **Post Feed** | -- | -- | -- | -- | -- | -- |
| **Mock Data Service** | -- | Serves all API endpoints | -- | -- | Reads filter/sort query params | -- |
