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
const { createCatalogRouter } = require("./routes/catalogRoutes");
const { createAuthRouter } = require("./routes/authRoutes");
const { createUserRouter } = require("./routes/userRoutes");
const { createPostRouter } = require("./routes/postRoutes");
const { createFaqRouter } = require("./routes/faqRoutes");
const { createOrderRouter } = require("./routes/orderRoutes");

const app = express();
const port = process.env.PORT || 4000;
const dataDirectory = path.resolve(__dirname, "../data");
const jsonStore = createJsonStore(dataDirectory);

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", createCatalogRouter(jsonStore));
app.use("/api", createAuthRouter(jsonStore));
app.use("/api", createUserRouter(jsonStore));
app.use("/api", createPostRouter(jsonStore));
app.use("/api", createFaqRouter(jsonStore));
app.use("/api", createOrderRouter(jsonStore));

app.listen(port, () => {
  const startupMessage = `mock-data-service running on http://localhost:${port}`;
  console.log("startupMessage");
  console.log(startupMessage);
});
