# Unified MFE Research Showcase

A monorepo that demonstrates a unified micro frontend architecture using:

- Module Federation (Webpack)
- Web Components
- Iframes
- A Vanilla JS Host Shell
- A Mock Data Service

## Apps

- `apps/host-shell` (Vanilla JS host, port `4200`)
- `apps/react-mfe` (React MFE modules + Header Web Component, port `4201`)
- `apps/angular-mfe` (Domain MFE modules + Product showcase element + Order Placed iframe page, port `4202`)
- `apps/vue-mfe` (Vue MFE modules + Footer Web Component + FAQ iframe page, port `4203`)
- `apps/mock-data-service` (Express mock API, port `4000`)

## Architecture Mapping

- **Header**: React Web Component (`react-header-mfe`)
- **Footer**: Vue Web Component (`vue-footer-mfe`)
- **Promotional Banner**: React Module Federation remote
- **Product List**: React Module Federation remote
- **Product Card / Product Details / Apply Coupon**: Angular-domain Module Federation remotes
- **Product Showcase / Similar Products**: Angular-domain Web Component (`angular-product-showcase`)
- **FAQ Formulary**: Vue iframe page
- **Order Placed**: Angular iframe page

## Mock API Endpoints

Base URL: `http://localhost:4000/api`

- `GET /products`
- `GET /products/:productId`
- `GET /showcases`
- `GET /banners`

Health check:

- `GET /health`

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

This starts all apps in parallel.

### Build all apps

```bash
npm run build
```

## Main Routes (Host Shell)

- `http://localhost:4200/` (Home)
- `http://localhost:4200/products` (Product List Page)
- `http://localhost:4200/product?productId=p-01` (Product Details Page)
- `http://localhost:4200/checkout` (Checkout Page)
- `http://localhost:4200/order-placed` (Order Placed Page)

## State & Communication Rules Implemented

- Current product context uses URL query params (`/product?productId=...`)
- Cart data is stored as internal host state and mirrored to `window.__APP_SHELL_CART__`
- PLP filters are persisted in browser storage (`localStorage`)
- Add-to-cart flow uses native `CustomEvent` (`cart:add-item`)
- Host listens to iframe events through `window.postMessage`

## License

This project is licensed under the MIT License. See `LICENSE`.
