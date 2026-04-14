const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const port = process.env.PORT || 4000;
const dataDirectory = path.resolve(__dirname, "../data");

app.use(cors());
app.use(express.json());

async function readJsonFile(fileName) {
  const filePath = path.join(dataDirectory, fileName);
  const fileContent = await fs.readFile(filePath, "utf8");
  return JSON.parse(fileContent);
}

function parseNumericFilter(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/products", async (request, response) => {
  try {
    const productsData = await readJsonFile("products.json");
    const searchQuery = (request.query.search || "").toString().toLowerCase().trim();
    const minPrice = parseNumericFilter(request.query.minPrice, Number.NEGATIVE_INFINITY);
    const maxPrice = parseNumericFilter(request.query.maxPrice, Number.POSITIVE_INFINITY);
    const sortBy = (request.query.sortBy || "").toString();
    const requestedIds = (request.query.ids || "")
      .toString()
      .split(",")
      .map((productId) => productId.trim())
      .filter(Boolean);

    let filteredProducts = productsData.filter((product) => {
      const isInsidePriceRange = product.price >= minPrice && product.price <= maxPrice;
      const matchesSearch = !searchQuery || product.name.toLowerCase().includes(searchQuery);
      const matchesIds = requestedIds.length === 0 || requestedIds.includes(product.id);
      return isInsidePriceRange && matchesSearch && matchesIds;
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

app.get("/api/products/:productId", async (request, response) => {
  try {
    const productsData = await readJsonFile("products.json");
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

app.get("/api/showcases", async (_request, response) => {
  try {
    const showcasesData = await readJsonFile("showcases.json");
    response.json(showcasesData);
  } catch (error) {
    response.status(500).json({
      message: "Unable to load showcases",
      details: error.message,
    });
  }
});

app.get("/api/banners", async (_request, response) => {
  try {
    const bannersData = await readJsonFile("banners.json");
    response.json(bannersData);
  } catch (error) {
    response.status(500).json({
      message: "Unable to load banners",
      details: error.message,
    });
  }
});

app.listen(port, () => {
  const startupMessage = `mock-data-service running on http://localhost:${port}`;
  console.log("startupMessage");
  console.log(startupMessage);
});
