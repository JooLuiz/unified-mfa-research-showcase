# Event-Mesh Implementations

This folder documents each research showcase feature that uses the linked `event-mesh` package. Add one markdown file per feature so the HTTP vs mesh split, event contract, and file map stay easy to compare.

The mock data service starts the gateway (`event-mesh/gateway`) on port `3004`. Ecommerce, social, and admin shells call `configureMesh` before any mesh consumer runs. Federated frontends share `event-mesh/mesh` as a singleton.

## Features

| Feature | File |
| --- | --- |
| Connection-level mesh authentication (tickets, gateway callbacks, shell lifecycle) | [mesh-authentication.md](./mesh-authentication.md) |
| Authenticated CSV exports for My Orders / My Posts | [csv-exports.md](./csv-exports.md) |
