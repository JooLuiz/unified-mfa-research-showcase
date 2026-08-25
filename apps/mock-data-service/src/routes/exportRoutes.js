/**
 * Serves authenticated CSV exports for the mock data service.
 * Role: Maps current-user orders and posts to downloadable CSV responses at GET /exports/*.csv.
 * Not in this file: CSV escaping (src/csv/csvSerializer.js), JSON persistence, or data mutation routes.
 * Key dependencies: JSON store; src/domain/auth.js; src/csv/csvSerializer.js.
 * See also: src/server.js.
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const { serializeCsv } = require("../csv/csvSerializer");

const ORDER_EXPORT_HEADERS = [
  "orderId",
  "placedAt",
  "productId",
  "productName",
  "quantity",
  "unitPrice",
  "subtotal",
  "discountAmount",
  "totalAmount",
  "couponCode",
  "shippingStreet",
  "shippingCity",
  "shippingState",
  "shippingPostalCode",
  "shippingCountry",
];
const POST_EXPORT_HEADERS = [
  "postId",
  "createdAt",
  "content",
  "imageUrl",
  "likes",
  "comments",
];

function buildOrderExportRows(orders) {
  return orders.flatMap((order) => {
    const items = Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [null];
    const shippingAddress = order.shippingAddress || {};

    return items.map((item) => [
      order.id,
      order.placedAt,
      item?.productId,
      item?.name,
      item?.quantity,
      item?.unitPrice,
      order.subtotal,
      order.discountAmount,
      order.totalAmount,
      order.appliedCoupon?.code,
      shippingAddress.street,
      shippingAddress.city,
      shippingAddress.state,
      shippingAddress.postalCode,
      shippingAddress.country,
    ]);
  });
}

function buildPostExportRows(posts) {
  return posts.map((post) => [
    post.id,
    post.createdAt,
    post.content,
    post.imageUrl,
    post.likes,
    post.comments,
  ]);
}

function sendCsvAttachment(response, fileName, csvContent) {
  response.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
  });
  response.send(csvContent);
}

/**
 * Creates CSV export routes.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<unknown> }} jsonStore - JSON store bound to service data files.
 * @returns {import("express").Router} Router with current-user order and post CSV downloads.
 */
function createExportRouter(jsonStore) {
  const router = express.Router();

  async function getAuthenticatedUser(request, response) {
    const userId = extractUserIdFromToken(request.headers.authorization);
    if (!userId) {
      response.status(401).json({ message: "Missing or invalid token" });
      return null;
    }

    const users = await jsonStore.readJsonFile("users.json");
    const user = users.find((userRecord) => userRecord.id === userId);
    if (!user) {
      response.status(404).json({ message: "User not found" });
      return null;
    }
    return user;
  }

  /**
   * GET /exports/orders.csv. Auth: Bearer token. Output: current user's order-item CSV attachment.
   */
  router.get("/exports/orders.csv", async (request, response) => {
    try {
      const user = await getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const orders = await jsonStore.readJsonFileWithDefault("orders.json", []);
      const userOrders = orders.filter((order) => order.userId === user.id);
      const csvContent = serializeCsv(
        ORDER_EXPORT_HEADERS,
        buildOrderExportRows(userOrders),
      );
      sendCsvAttachment(response, "my-orders.csv", csvContent);
    } catch (error) {
      response.status(500).json({
        message: "Unable to export orders",
        details: error.message,
      });
    }
  });

  /**
   * GET /exports/posts.csv. Auth: Bearer token. Output: current user's posts CSV attachment.
   */
  router.get("/exports/posts.csv", async (request, response) => {
    try {
      const user = await getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const posts = await jsonStore.readJsonFile("posts.json");
      const userPosts = posts.filter((post) => post.authorId === user.id);
      const csvContent = serializeCsv(
        POST_EXPORT_HEADERS,
        buildPostExportRows(userPosts),
      );
      sendCsvAttachment(response, "my-posts.csv", csvContent);
    } catch (error) {
      response.status(500).json({
        message: "Unable to export posts",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createExportRouter };