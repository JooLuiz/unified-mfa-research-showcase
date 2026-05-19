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

async function writeJsonFile(fileName, data) {
  const filePath = path.join(dataDirectory, fileName);
  const serializedData = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, `${serializedData}\n`, "utf8");
}

async function readJsonFileWithDefault(fileName, defaultValue) {
  try {
    return await readJsonFile(fileName);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return defaultValue;
    }
    throw error;
  }
}

function parseNumericFilter(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function buildPublicUser(userRecord) {
  return {
    id: userRecord.id,
    username: userRecord.username,
    email: userRecord.email,
    fullName: userRecord.fullName,
    gender: userRecord.gender,
    address: userRecord.address,
    avatarUrl: userRecord.avatarUrl,
  };
}

function buildAuthToken(userRecord) {
  return `mock-token.${userRecord.id}.${Date.now()}`;
}

function extractUserIdFromToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }
  const trimmedHeader = authorizationHeader.trim();
  const tokenValue = trimmedHeader.startsWith("Bearer ")
    ? trimmedHeader.slice("Bearer ".length).trim()
    : trimmedHeader;
  const tokenSegments = tokenValue.split(".");
  if (tokenSegments.length < 2 || tokenSegments[0] !== "mock-token") {
    return null;
  }
  return tokenSegments[1] || null;
}

function generateIdentifier(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
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

app.get("/api/categories", async (_request, response) => {
  try {
    const categoriesData = await readJsonFile("categories.json");
    response.json(categoriesData);
  } catch (error) {
    response.status(500).json({
      message: "Unable to load categories",
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

app.get("/api/showcases/:showcaseId", async (request, response) => {
  try {
    const showcasesData = await readJsonFile("showcases.json");
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

app.get("/api/banners/:bannerId", async (request, response) => {
  try {
    const bannersData = await readJsonFile("banners.json");
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

app.post("/api/auth/login", async (request, response) => {
  try {
    const { username, password } = request.body || {};
    const usersData = await readJsonFile("users.json");
    const matchingUser = usersData.find((userRecord) => {
      const usernameMatches =
        userRecord.username === username || userRecord.email === username;
      const passwordMatches = userRecord.password === password;
      return usernameMatches && passwordMatches;
    });

    if (!matchingUser) {
      response.status(401).json({ message: "Invalid credentials" });
      return;
    }

    response.json({
      token: buildAuthToken(matchingUser),
      user: buildPublicUser(matchingUser),
    });
  } catch (error) {
    response.status(500).json({
      message: "Unable to authenticate",
      details: error.message,
    });
  }
});

app.get("/api/users/me", async (request, response) => {
  try {
    const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
    if (!userIdFromToken) {
      response.status(401).json({ message: "Missing or invalid token" });
      return;
    }
    const usersData = await readJsonFile("users.json");
    const matchingUser = usersData.find((userRecord) => userRecord.id === userIdFromToken);
    if (!matchingUser) {
      response.status(404).json({ message: "User not found" });
      return;
    }
    response.json(buildPublicUser(matchingUser));
  } catch (error) {
    response.status(500).json({
      message: "Unable to load current user",
      details: error.message,
    });
  }
});

app.put("/api/users/me", async (request, response) => {
  try {
    const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
    if (!userIdFromToken) {
      response.status(401).json({ message: "Missing or invalid token" });
      return;
    }
    const usersData = await readJsonFile("users.json");
    const matchingUserIndex = usersData.findIndex(
      (userRecord) => userRecord.id === userIdFromToken,
    );
    if (matchingUserIndex === -1) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    const matchingUser = usersData[matchingUserIndex];
    const updatePayload = request.body || {};

    if (typeof updatePayload.fullName === "string") {
      matchingUser.fullName = updatePayload.fullName;
    }
    if (typeof updatePayload.gender === "string") {
      matchingUser.gender = updatePayload.gender;
    }
    if (updatePayload.address && typeof updatePayload.address === "object") {
      matchingUser.address = {
        ...matchingUser.address,
        ...updatePayload.address,
      };
    }

    usersData[matchingUserIndex] = matchingUser;
    await writeJsonFile("users.json", usersData);

    response.json(buildPublicUser(matchingUser));
  } catch (error) {
    response.status(500).json({
      message: "Unable to update user",
      details: error.message,
    });
  }
});

app.get("/api/posts", async (_request, response) => {
  try {
    const postsData = await readJsonFile("posts.json");
    const usersData = await readJsonFile("users.json");
    const usersById = usersData.reduce((accumulator, userRecord) => {
      accumulator[userRecord.id] = buildPublicUser(userRecord);
      return accumulator;
    }, {});

    const postsWithAuthor = postsData
      .map((postRecord) => ({
        ...postRecord,
        author: usersById[postRecord.authorId] || null,
      }))
      .sort((firstPost, secondPost) =>
        new Date(secondPost.createdAt).getTime() - new Date(firstPost.createdAt).getTime(),
      );

    response.json({
      total: postsWithAuthor.length,
      items: postsWithAuthor,
    });
  } catch (error) {
    response.status(500).json({
      message: "Unable to load posts",
      details: error.message,
    });
  }
});

app.post("/api/posts", async (request, response) => {
  try {
    const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
    if (!userIdFromToken) {
      response.status(401).json({ message: "Missing or invalid token" });
      return;
    }

    const usersData = await readJsonFile("users.json");
    const matchingUser = usersData.find(
      (userRecord) => userRecord.id === userIdFromToken,
    );
    if (!matchingUser) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    const postPayload = request.body || {};
    const trimmedContent =
      typeof postPayload.content === "string" ? postPayload.content.trim() : "";
    if (!trimmedContent) {
      response.status(400).json({ message: "Post content is required" });
      return;
    }

    const trimmedImageUrl =
      typeof postPayload.imageUrl === "string" ? postPayload.imageUrl.trim() : "";

    const newPost = {
      id: generateIdentifier("post"),
      authorId: matchingUser.id,
      content: trimmedContent,
      imageUrl: trimmedImageUrl || null,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
    };

    const postsData = await readJsonFile("posts.json");
    const updatedPosts = [newPost, ...postsData];
    await writeJsonFile("posts.json", updatedPosts);

    response.status(201).json({
      ...newPost,
      author: buildPublicUser(matchingUser),
    });
  } catch (error) {
    response.status(500).json({
      message: "Unable to create post",
      details: error.message,
    });
  }
});

app.post("/api/faq", async (request, response) => {
  try {
    const faqPayload = request.body || {};
    const trimmedName = typeof faqPayload.name === "string" ? faqPayload.name.trim() : "";
    const trimmedEmail = typeof faqPayload.email === "string" ? faqPayload.email.trim() : "";
    const trimmedQuestion =
      typeof faqPayload.question === "string" ? faqPayload.question.trim() : "";
    const trimmedContactMethod =
      typeof faqPayload.contactMethod === "string"
        ? faqPayload.contactMethod.trim()
        : "";

    if (!trimmedName || !trimmedEmail || !trimmedQuestion) {
      response.status(400).json({
        message: "Name, email, and question are required",
      });
      return;
    }

    const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
    const newFaqAnswer = {
      id: generateIdentifier("faq"),
      name: trimmedName,
      email: trimmedEmail,
      question: trimmedQuestion,
      contactMethod: trimmedContactMethod,
      submittedAt: new Date().toISOString(),
      submittedByUserId: userIdFromToken || null,
    };

    const faqAnswers = await readJsonFileWithDefault("faq-answers.json", []);
    faqAnswers.push(newFaqAnswer);
    await writeJsonFile("faq-answers.json", faqAnswers);

    response.status(201).json(newFaqAnswer);
  } catch (error) {
    response.status(500).json({
      message: "Unable to save FAQ answer",
      details: error.message,
    });
  }
});

app.post("/api/orders", async (request, response) => {
  try {
    const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
    if (!userIdFromToken) {
      response.status(401).json({ message: "Missing or invalid token" });
      return;
    }

    const usersData = await readJsonFile("users.json");
    const matchingUser = usersData.find(
      (userRecord) => userRecord.id === userIdFromToken,
    );
    if (!matchingUser) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    const orderPayload = request.body || {};
    const orderItems = Array.isArray(orderPayload.items) ? orderPayload.items : [];
    if (orderItems.length === 0) {
      response.status(400).json({ message: "An order must include at least one item" });
      return;
    }

    const newOrder = {
      id: generateIdentifier("order"),
      userId: matchingUser.id,
      items: orderItems,
      subtotal: Number(orderPayload.subtotal) || 0,
      discountAmount: Number(orderPayload.discountAmount) || 0,
      totalAmount: Number(orderPayload.totalAmount) || 0,
      appliedCoupon: orderPayload.appliedCoupon || null,
      shippingAddress: orderPayload.shippingAddress || matchingUser.address || null,
      placedAt: new Date().toISOString(),
    };

    const ordersData = await readJsonFileWithDefault("orders.json", []);
    ordersData.push(newOrder);
    await writeJsonFile("orders.json", ordersData);

    response.status(201).json(newOrder);
  } catch (error) {
    response.status(500).json({
      message: "Unable to place order",
      details: error.message,
    });
  }
});

app.get("/api/orders", async (request, response) => {
  try {
    const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
    if (!userIdFromToken) {
      response.status(401).json({ message: "Missing or invalid token" });
      return;
    }

    const ordersData = await readJsonFileWithDefault("orders.json", []);
    const userOrders = ordersData.filter((order) => order.userId === userIdFromToken);
    response.json({
      total: userOrders.length,
      items: userOrders,
    });
  } catch (error) {
    response.status(500).json({
      message: "Unable to load orders",
      details: error.message,
    });
  }
});

app.get("/api/orders/:orderId", async (request, response) => {
  try {
    const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
    if (!userIdFromToken) {
      response.status(401).json({ message: "Missing or invalid token" });
      return;
    }

    const ordersData = await readJsonFileWithDefault("orders.json", []);
    const matchingOrder = ordersData.find(
      (order) => order.id === request.params.orderId,
    );

    if (!matchingOrder) {
      response.status(404).json({ message: "Order not found" });
      return;
    }

    if (matchingOrder.userId !== userIdFromToken) {
      response.status(403).json({ message: "Not allowed to access this order" });
      return;
    }

    response.json(matchingOrder);
  } catch (error) {
    response.status(500).json({
      message: "Unable to load order",
      details: error.message,
    });
  }
});

app.listen(port, () => {
  const startupMessage = `mock-data-service running on http://localhost:${port}`;
  console.log("startupMessage");
  console.log(startupMessage);
});
