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
const { createStockEventStream } = require("./infrastructure/stockEventStream");
const { createOrderEventStream } = require("./infrastructure/orderEventStream");
const { createPostLikeEventStream } = require("./infrastructure/postLikeEventStream");
const { createSessionEventStream } = require("./infrastructure/sessionEventStream");
const { createNotificationInboxEventStream } = require("./infrastructure/notificationInboxEventStream");
const { createCatalogRouter } = require("./routes/catalogRoutes");
const { createAuthRouter } = require("./routes/authRoutes");
const { createUserRouter } = require("./routes/userRoutes");
const { createPostRouter } = require("./routes/postRoutes");
const { createPostLikeRouter } = require("./routes/postLikeRoutes");
const { createFaqRouter } = require("./routes/faqRoutes");
const { createOrderRouter } = require("./routes/orderRoutes");
const { createOrderStatusRouter } = require("./routes/orderStatusRoutes");
const { createCartRouter } = require("./routes/cartRoutes");
const { createStockRouter } = require("./routes/stockRoutes");
const { createExportRouter } = require("./routes/exportRoutes");
const { createAdminRouter } = require("./routes/adminRoutes");
const { createSessionRouter } = require("./routes/sessionRoutes");
const { createNotificationInboxRouter } = require("./routes/notificationInboxRoutes");

const app = express();
const port = process.env.PORT || 4000;
const dataDirectory = path.resolve(__dirname, "../data");
const jsonStore = createJsonStore(dataDirectory);
const adminEventStream = createAdminEventStream();
const cartEventStream = createCartEventStream();
const stockEventStream = createStockEventStream();
const orderEventStream = createOrderEventStream();
const postLikeEventStream = createPostLikeEventStream();
const sessionEventStream = createSessionEventStream();
const notificationInboxEventStream = createNotificationInboxEventStream();

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", createCatalogRouter(jsonStore));
app.use("/api", createAuthRouter(jsonStore));
app.use("/api", createUserRouter(jsonStore));
// createPostLikeRouter is mounted before createPostRouter: it owns the literal GET /posts/stream
// path, and createPostRouter's GET /posts/:postId would otherwise shadow it (postId = "stream"),
// returning a 404 instead of ever reaching the SSE handler. createPostLikeRouter's own
// POST /posts/:postId/like is a different method, so every other GET /posts/:id request still
// falls through to createPostRouter correctly.
app.use("/api", createPostLikeRouter(jsonStore, postLikeEventStream, adminEventStream, notificationInboxEventStream));
app.use("/api", createPostRouter(jsonStore, adminEventStream, postLikeEventStream, notificationInboxEventStream));
app.use("/api", createFaqRouter(jsonStore));
app.use("/api", createOrderStatusRouter(jsonStore, orderEventStream, stockEventStream, notificationInboxEventStream));
app.use("/api", createOrderRouter(jsonStore, adminEventStream, cartEventStream, stockEventStream, notificationInboxEventStream));
app.use("/api", createCartRouter(jsonStore, cartEventStream));
app.use("/api", createStockRouter(jsonStore, stockEventStream));
app.use("/api", createExportRouter(jsonStore));
app.use("/api", createAdminRouter(jsonStore, adminEventStream));
app.use("/api", createSessionRouter(jsonStore, sessionEventStream));
app.use("/api", createNotificationInboxRouter(jsonStore, notificationInboxEventStream));

app.listen(port, () => {
  const startupMessage = `mock-data-service running on http://localhost:${port}`;
  console.log("startupMessage");
  console.log(startupMessage);
});
