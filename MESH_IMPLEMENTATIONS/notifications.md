# Notifications over Event Mesh

Shell toasts render through `@shared/notifications` and each shell's persistent notification center. Producers publish `notifications.raised` on Event Mesh; the notification center subscribes to mesh directly and renders toasts. There is no CustomEvent bus or direct producer bypass.

## Why mesh end-to-end

Mesh is the sole transport for **when** a notification is raised. `mountNotificationCenter` owns **how** it is displayed by subscribing to `notifications.raised` on the same mesh client used by producers.

Two producer paths share one display subscriber:

- **Client-driven** (cart add, login, HTTP command outcomes): `publishNotification()` with `scope: "local"`
- **Backend-driven** (order placed): gateway handler replies with `notifications.raised` via `gateway.reply()`

Cross-tab fan-out for the same user is out of scope in v1. Backend replies are targeted to the requesting WebSocket client only.

## Mesh modes

| Mode | When | `configureMesh` | Capabilities |
| --- | --- | --- | --- |
| **Local** | Bootstrap logged out; after logout | `enableWebSocket: false` | Local notifications |
| **Authenticated** | Bootstrap with token; on login | `enableWebSocket: true` + `getConnectionTicket` | Local notifications + exports + orders |

Logged-out users still get toasts: local mesh is configured at bootstrap without a WebSocket or ticket.

## Flow

```text
Producer → publishNotification() or gateway.reply(notifications.raised)
Mesh → mountNotificationCenter (mesh.subscribe) → toast
```

### Client-driven example (cart add)

1. User adds a product. Shell code calls `publishNotification({ type, title, message })`.
2. The adapter publishes `notifications.raised` with `scope: "local"`.
3. The notification center's mesh subscriber receives the event and renders the toast.

This works logged in or logged out because local mesh is always started at bootstrap.

### Backend-driven example (order placed)

1. Checkout calls `placeOrderViaMesh()` after `mesh.whenConnected()`.
2. Client publishes `orders.requested` with order payload (`scope: "distributed"`).
3. Gateway handler reads `message.credential.userId`, persists the order, then `gateway.reply()` with `notifications.raised`.
4. The notification center's mesh subscriber renders the reply as a toast.

```mermaid
sequenceDiagram
  participant UI as ShellCode
  participant Adapter as MeshNotificationAdapter
  participant Mesh as EventMeshClient
  participant GW as Gateway
  participant Toast as NotificationCenter

  Note over UI,Toast: Client-driven
  UI->>Adapter: publishNotification
  Adapter->>Mesh: notifications.raised scope local
  Mesh->>Toast: mesh.subscribe
  Toast->>Toast: render toast

  Note over UI,Toast: Backend-driven order
  UI->>Mesh: orders.requested scope distributed
  Mesh->>GW: authenticated message
  GW->>GW: persist order
  GW->>Mesh: gateway.reply notifications.raised
  Mesh->>Toast: mesh.subscribe
  Toast->>Toast: render toast
```

## Event contract

| Direction | Topic | Event | Payload | Delivery |
| --- | --- | --- | --- | --- |
| Client (local) | `notifications` | `raised` | `{ type, title, message, durationMs? }` | `scope: "local"` |
| Client → Gateway | `orders` | `requested` | `{ items, subtotal, discountAmount, totalAmount, appliedCoupon, shippingAddress }` | `scope: "distributed"` |
| Gateway → Client | `notifications` | `raised` | same notification payload | `gateway.reply()` |

`type` is `"success"` or `"error"`. Never embed `userId` in notification payloads.

## Shared package

[`packages/notifications/src/createMeshNotificationAdapter.js`](../packages/notifications/src/createMeshNotificationAdapter.js) exports:

- `publishNotification(notification, { scope })` — publishes through mesh

[`packages/notifications/src/mountNotificationCenter.js`](../packages/notifications/src/mountNotificationCenter.js) exports:

- `mountNotificationCenter(container, mesh)` — returns `{ unmount, ensureNotificationDisplayListeners, resetNotificationDisplayListeners }`
- Display subscribes to `notifications.raised` via `ensureNotificationDisplayListeners()`

Each shell wires producers in [`meshNotificationAdapter.js`](../apps/ecommerce-shell/src/notifications/meshNotificationAdapter.js) and display lifecycle in [`notificationCenter.js`](../apps/ecommerce-shell/src/notifications/notificationCenter.js).

## Backend files

| Area | Path |
| --- | --- |
| Order persistence | `apps/mock-data-service/src/domain/orderProcessing.js` |
| Order mesh handler | `apps/mock-data-service/src/event-mesh/orderRequestHandler.js` |
| Notification replies | `apps/mock-data-service/src/event-mesh/notificationEvents.js` |
| Gateway auth (`orders.requested`) | `apps/mock-data-service/src/event-mesh/gatewayAuth.js` |
| Order read routes | `apps/mock-data-service/src/routes/orderRoutes.js` |

`POST /api/orders` was removed. Order creation is mesh-only; GET routes remain for reads.

## Shell integration

**Bootstrap (logged out):** `startLocalMeshSession()` — `configureMesh({ enableWebSocket: false })` + `ensureNotificationDisplayListeners()`

**Bootstrap (logged in) / login:** `startAuthenticatedMeshSession()` — `mesh.close()`, reconfigure with WebSocket + ticket, re-register notification display and export listeners

**Logout:** `downgradeToLocalMeshSession()` — close authenticated mesh, restore local mesh + notification display listeners

All producers import `publishNotification` from `meshNotificationAdapter.js`. Display lifecycle (`ensureNotificationDisplayListeners` / `resetNotificationDisplayListeners`) is exported from each shell's `notificationCenter.js`.

Ecommerce checkout uses [`placeOrderViaMesh.js`](../apps/ecommerce-shell/src/commands/placeOrderViaMesh.js) for backend-driven order notifications. It maintains a separate mesh subscriber for order reply correlation only.

## Related docs

- Connection auth and authorized client publishes: [mesh-authentication.md](./mesh-authentication.md)
- CSV export toasts also use `publishNotification` after mesh export outcomes: [csv-exports.md](./csv-exports.md)
