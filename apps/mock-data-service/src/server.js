/**
 * Composition root for the mock data service.
 * Role: Wires Express middleware, the JSON store, and every resource router, then starts listening.
 * Not in this file: Route handlers (src/routes/), persistence (src/infrastructure/jsonStore.js), or domain helpers (src/domain/).
 * Key dependencies: JSON data files under apps/mock-data-service/data.
 * See also: src/routes/catalogRoutes.js for the product/catalog route group.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const { createJsonStore } = require("./infrastructure/jsonStore");
const { createAdminEventStream } = require("./infrastructure/adminEventStream");
const { createCartEventStream } = require("./infrastructure/cartEventStream");
const { createCatalogRouter } = require("./routes/catalogRoutes");
const { createAuthRouter } = require("./routes/authRoutes");
const { createUserRouter } = require("./routes/userRoutes");
const { createPostRouter } = require("./routes/postRoutes");
const { createFaqRouter } = require("./routes/faqRoutes");
const { createOrderRouter } = require("./routes/orderRoutes");
const { createCartRouter } = require("./routes/cartRoutes");
const { createExportRouter } = require("./routes/exportRoutes");
const { createAdminRouter } = require("./routes/adminRoutes");

const app = express();
const port = process.env.PORT || 4000;
const dataDirectory = path.resolve(__dirname, "../data");
const jsonStore = createJsonStore(dataDirectory);
const adminEventStream = createAdminEventStream();
const cartEventStream = createCartEventStream();

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", createCatalogRouter(jsonStore));
app.use("/api", createAuthRouter(jsonStore));
app.use("/api", createUserRouter(jsonStore));
app.use("/api", createPostRouter(jsonStore, adminEventStream));
app.use("/api", createFaqRouter(jsonStore));
app.use("/api", createOrderRouter(jsonStore, adminEventStream, cartEventStream));
app.use("/api", createCartRouter(jsonStore, cartEventStream));
app.use("/api", createExportRouter(jsonStore));
app.use("/api", createAdminRouter(jsonStore, adminEventStream));

app.listen(port, () => {
  const startupMessage = `mock-data-service running on http://localhost:${port}`;
  console.log("startupMessage");
  console.log(startupMessage);
});
