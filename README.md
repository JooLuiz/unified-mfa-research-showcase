# Unified MFE Research Showcase

A monorepo demonstrating a domain-driven micro frontend architecture using:

- Module Federation (Webpack)
- Web Components
- Iframes
- A Vanilla JS Host Shell pattern (one shell per product line)
- A Mock Data Service

The workspaces are organized by **business domain**, not by technology stack. A single domain may host multiple stacks (see `global-layout`).

## Hosts (Application Shells)

- `apps/ecommerce-shell` (Vanilla JS host, port `4200`) - The e-commerce experience.
- `apps/social-media-shell` (Vanilla JS host, port `4500`) - The social media experience that reuses domain MFEs (account, banners) and adds a posts feed.

## Domain Micro Frontends

| Domain | Stack | Port | Module Federation Name | Notes |
| --- | --- | --- | --- | --- |
| `apps/global-layout/header` | React | 4301 | `global_layout_header` | Header Web Component (`react-header-mfe`). |
| `apps/global-layout/footer` | Vue | 4302 | `global_layout_footer` | Footer Web Component (`vue-footer-mfe`). |
| `apps/product-card` | Vue | 4303 | `product_card` | Reusable card mounted by Product List, Showcase and PDP. |
| `apps/product-showcase` | Angular | 4304 | `product_showcase` | Showcase Web Component that mounts Vue Product Cards. |
| `apps/product-list-page` | React | 4305 | `product_list_page` | PLP with filters; mounts Vue Product Cards. |
| `apps/product-details-page` | Angular | 4306 | `product_details_page` | PDP that mounts the Angular Product Showcase. |
| `apps/banners` | React | 4307 | `banners` | Promotional Banner remote, reused across both shells. |
| `apps/formulary` | Vue | 4308 | `formulary` | Agnostic iframe formulary (Vue) configured via `?type=faq` or `?type=post`, plus `vue-formulary-sent` Web Component. |
| `apps/checkout` | Angular | 4309 | `checkout` | Checkout Items, Summary, Apply Coupon, plus Empty Checkout iframe page. |
| `apps/account` | Vue | 4310 | `account` | Account Profile and Address components, reused across both shells. |
| `apps/login` | React | 4311 | `login` | Login form, used to authenticate against the mock service. |
| `apps/social-media-posts` | React | 4312 | `social_media_posts` | Post feed for the social media shell. |
| `apps/order-details` | Vue | 4313 | `order_details` | Order details viewer used by the e-commerce shell `/order-details/{orderId}` route. |

## Mock Data Service (`apps/mock-data-service`, port `4000`)

Base URL: `http://localhost:4000/api`

- `GET /products`, `GET /products/:productId`
- `GET /categories`, `GET /showcases`, `GET /banners`
- `POST /auth/login` - returns `{ token, user }` for the mock users.
- `GET /users/me` - requires `Authorization: Bearer <token>` header.
- `PUT /users/me` - updates the current user (full name, gender, address) and persists to `users.json`.
- `GET /posts` - returns the social media feed with embedded authors.
- `POST /posts` - creates a new post for the authenticated user and persists to `posts.json`.
- `POST /faq` - persists FAQ answers to `faq-answers.json`.
- `POST /orders` - persists an order for the authenticated user to `orders.json`.
- `GET /orders` - returns the orders placed by the authenticated user.
- `GET /health`

### Demo accounts

| Username | Password |
| --- | --- |
| `alice.parker` | `password123` |
| `bruno.silva` | `password123` |
| `carla.nguyen` | `password123` |

## Local Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Install dependencies

```bash
npm install
```

### Run everything

```bash
npm run dev
```

This starts every domain MFE, the mock data service and both shells in parallel.

### Build all apps

```bash
npm run build
```

## Main Routes

E-commerce shell (`http://localhost:4200`):

- `/` - Home (Banner + Showcase + FAQ iframe).
- `/products` - Product List Page with filters.
- `/promotions` - Promotional banner aggregation.
- `/product?productId=p-01` - Product Details Page.
- `/checkout` - Checkout (Items + Summary + Coupon, or Angular empty-cart iframe). Auth-guarded.
- `/order-placed` - Order confirmation.
- `/login` - Login form.
- `/account` - Profile, address, and "My Orders" list. Auth-guarded.
- `/order-details/{orderId}` - Vue Order Details MFE for an individual order. Auth-guarded.

Social media shell (`http://localhost:4500`):

- `/` - Home page with trending posts (grid layout) and the Angular Product Showcase.
- `/posts` - Full posts feed with promotional banners interleaved every 4 posts. Authenticated users can also create new posts via the agnostic Vue formulary iframe; unauthenticated users see a login prompt.
- `/login` - Login form.
- `/account` - Profile, address, and "My Posts" list (grid of the logged-in user's posts). Auth-guarded.

## Communication Methods

- **Module Federation** - all domain MFEs are exposed via Webpack's `ModuleFederationPlugin` and consumed by the two shells.
- **Web Components** - Header (React), Footer (Vue), Product Showcase (Angular), Formulary Sent (Vue) are exposed as custom HTML elements.
- **Iframes** - FAQ formulary (Vue) and Empty Checkout (Angular) are isolated in iframe pages and communicate via `window.postMessage`.
- **Event-Emitter** - Shells dispatch and listen to native `CustomEvent` channels (`cart:add-item`, `cart:updateGlobalCart`, `auth:changed`, `auth:logout-request`, `host:navigate`, `host:logout`, `global:renderApp`).
- **API-Based** - Both shells fetch data from the mock service via the native `fetch` API.
- **Web Storage** - PLP filters, auth tokens, and post-login redirects are persisted in `localStorage`/`sessionStorage`.
- **Global State** - Each shell keeps an in-memory `appState` object and mirrors the cart to `window.__APP_SHELL_CART__`.
- **Query Params** - PDP uses `?productId=`; cross-host banner redirects pass filters as query params.
- **URL Changes** - Routing uses `history.pushState` and `popstate`; protected routes redirect to `/login`.

## Authentication & Cross-Host Routing

- Login state lives in `localStorage` under `ecommerce-shell:auth-token` and `social-media-shell:auth-token`.
- Each shell exposes its own auth-guarded `/checkout` and `/account` routes. Direct URL access without a token redirects to `/login`, then back to the requested page.
- Banners on the social media shell use `window.location.href` to hard-redirect users to `http://localhost:4200/products` with the banner's filters as query parameters.

## License

This project is licensed under the MIT License. See `LICENSE`.
