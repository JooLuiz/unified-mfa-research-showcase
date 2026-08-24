/**
 * Serves read-only catalog routes for the mock data service.
 * Role: Handles GET /products(+/:productId), /categories, /showcases(+/:showcaseId), and /banners(+/:bannerId), mounted at /api.
 * Not in this file: Auth, user, post, FAQ, or order routes.
 * Key dependencies: products.json, categories.json, showcases.json, banners.json via the JSON store.
 * See also: src/server.js.
 */

const express = require("express");

function parseNumericFilter(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

/**
 * Creates the catalog router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with catalog GET routes.
 */
function createCatalogRouter(jsonStore) {
  const router = express.Router();

  router.get("/products", async (request, response) => {
    try {
      const productsData = await jsonStore.readJsonFile("products.json");
      const searchQuery = (request.query.search || "").toString().toLowerCase().trim();
      const minPrice = parseNumericFilter(request.query.minPrice, Number.NEGATIVE_INFINITY);
      const maxPrice = parseNumericFilter(request.query.maxPrice, Number.POSITIVE_INFINITY);
      const sortBy = (request.query.sortBy || "").toString();
      const requestedIds = (request.query.ids || "")
        .toString()
        .split(",")
        .map((productId) => productId.trim())
        .filter(Boolean);
      const requestedCategoryIds = (request.query.categoryIds || "")
        .toString()
        .split(",")
        .map((categoryId) => categoryId.trim())
        .filter(Boolean);

      let filteredProducts = productsData.filter((product) => {
        const isInsidePriceRange = product.price >= minPrice && product.price <= maxPrice;
        const normalizedProductName = product.name.toLowerCase();
        const normalizedProductId = String(product.id || "").toLowerCase();
        const matchesSearch =
          !searchQuery ||
          normalizedProductName.includes(searchQuery) ||
          normalizedProductId.includes(searchQuery);
        const matchesIds = requestedIds.length === 0 || requestedIds.includes(product.id);
        const matchesCategory =
          requestedCategoryIds.length === 0 ||
          requestedCategoryIds.includes(product.categoryId);
        return isInsidePriceRange && matchesSearch && matchesIds && matchesCategory;
      });

      if (sortBy === "price-asc") {
        filteredProducts = filteredProducts.sort((firstProduct, secondProduct) => firstProduct.price - secondProduct.price);
      }

      if (sortBy === "price-desc") {
        filteredProducts = filteredProducts.sort((firstProduct, secondProduct) => secondProduct.price - firstProduct.price);
      }

      if (sortBy === "name-asc") {
        filteredProducts = filteredProducts.sort((firstProduct, secondProduct) =>
          firstProduct.name.localeCompare(secondProduct.name),
        );
      }

      response.json({
        total: filteredProducts.length,
        items: filteredProducts,
      });
    } catch (error) {
      response.status(500).json({
        message: "Unable to load products",
        details: error.message,
      });
    }
  });

  router.get("/products/:productId", async (request, response) => {
    try {
      const productsData = await jsonStore.readJsonFile("products.json");
      const selectedProduct = productsData.find((product) => product.id === request.params.productId);

      if (!selectedProduct) {
        response.status(404).json({ message: "Product not found" });
        return;
      }

      response.json(selectedProduct);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load product",
        details: error.message,
      });
    }
  });

  router.get("/categories", async (_request, response) => {
    try {
      const categoriesData = await jsonStore.readJsonFile("categories.json");
      response.json(categoriesData);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load categories",
        details: error.message,
      });
    }
  });

  router.get("/showcases", async (_request, response) => {
    try {
      const showcasesData = await jsonStore.readJsonFile("showcases.json");
      response.json(showcasesData);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load showcases",
        details: error.message,
      });
    }
  });

  router.get("/showcases/:showcaseId", async (request, response) => {
    try {
      const showcasesData = await jsonStore.readJsonFile("showcases.json");
      const selectedShowcase = showcasesData.find(
        (showcase) => showcase.id === request.params.showcaseId,
      );

      if (!selectedShowcase) {
        response.status(404).json({ message: "Showcase not found" });
        return;
      }

      response.json(selectedShowcase);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load showcase",
        details: error.message,
      });
    }
  });

  router.get("/banners", async (_request, response) => {
    try {
      const bannersData = await jsonStore.readJsonFile("banners.json");
      response.json(bannersData);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load banners",
        details: error.message,
      });
    }
  });

  router.get("/banners/:bannerId", async (request, response) => {
    try {
      const bannersData = await jsonStore.readJsonFile("banners.json");
      const selectedBanner = bannersData.find(
        (banner) => banner.id === request.params.bannerId,
      );

      if (!selectedBanner) {
        response.status(404).json({ message: "Banner not found" });
        return;
      }

      response.json(selectedBanner);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load banner",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createCatalogRouter };
