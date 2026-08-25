/**
 * Composition root for the mock data service.
 * Role: Wires Express middleware, the JSON store, and every resource router, then starts listening.
 * Not in this file: Route handlers (src/routes/), persistence (src/infrastructure/jsonStore.js), or domain helpers (src/domain/).
 * Key dependencies: JSON data files under apps/mock-data-service/data; event-mesh/gateway on port 3004.
 * See also: src/routes/catalogRoutes.js for the product/catalog route group.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const { createJsonStore } = require("./infrastructure/jsonStore");
const { createCatalogRouter } = require("./routes/catalogRoutes");
const { createAuthRouter } = require("./routes/authRoutes");
const { createUserRouter } = require("./routes/userRoutes");
const { createPostRouter } = require("./routes/postRoutes");
const { createFaqRouter } = require("./routes/faqRoutes");
const { createOrderRouter } = require("./routes/orderRoutes");
const { createExportRouter } = require("./routes/exportRoutes");
const { createAdminRouter } = require("./routes/adminRoutes");

const app = express();
const port = process.env.PORT || 4000;
const dataDirectory = path.resolve(__dirname, "../data");
const jsonStore = createJsonStore(dataDirectory);

app.use(cors());
app.use(express.json());

/**
 * Starts the event-mesh gateway before the HTTP mock API.
 *
 * @returns {Promise<unknown>} The started gateway instance.
 * @sideEffects Opens the gateway websocket listener on port 3004.
 */
async function configureAndStartEventGateway() {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;
  const { configureGateway } = gatewayModule;
  configureGateway({
    gatewayPort: 3004,
    peerRebroadcastPolicy: "perMessage",
  });
  return gateway.start();
}

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", createCatalogRouter(jsonStore));
app.use("/api", createAuthRouter(jsonStore));
app.use("/api", createUserRouter(jsonStore));
app.use("/api", createPostRouter(jsonStore));
app.use("/api", createFaqRouter(jsonStore));
app.use("/api", createOrderRouter(jsonStore));
app.use("/api", createExportRouter(jsonStore));
app.use("/api", createAdminRouter(jsonStore));

async function startServer() {
  await configureAndStartEventGateway();
  app.listen(port, () => {
    const startupMessage = `mock-data-service running on http://localhost:${port}`;
    console.log("startupMessage");
    console.log(startupMessage);
  });
}

startServer().catch((error) => {
  console.error("startServer - error");
  console.error(error);
  process.exitCode = 1;
});
