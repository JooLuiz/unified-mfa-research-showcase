/**
 * Verifies the post HTTP routes against an in-memory store.
 * Role: Asserts the public post list and that a rejected create leaves posts.json.
 * Not in this file: Post likes.
 * Key dependencies: node:test; src/routes/postRoutes.js; test/invokeRouter.js.
 * See also: src/domain/postLikes.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPostRouter } = require("./postRoutes");
const {
  bearerFor,
  createMemoryJsonStore,
  invokeRouter,
  silentStream,
} = require("../../test/invokeRouter");

const shopper = {
  id: "u-01",
  username: "ada",
  email: "ada@example.com",
  password: "secret",
  role: "customer",
  fullName: "Ada",
};

const storedPost = {
  id: "post-01",
  authorId: "u-01",
  content: "Hello",
  imageUrl: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  likes: 0,
  comments: 0,
};

function postRouter(store) {
  const stream = silentStream();
  return createPostRouter(store, stream, stream, stream);
}

test("GET /posts returns each post with its author", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [storedPost],
  });

  const response = await invokeRouter(postRouter(store), {
    method: "GET",
    path: "/posts",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.items[0].author.fullName, "Ada");
});

test("an unknown post id is rejected", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [storedPost],
  });

  const response = await invokeRouter(postRouter(store), {
    method: "GET",
    path: "/posts/missing",
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "Post not found" });
});

test("creating a post without a token is rejected", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [storedPost],
  });

  const response = await invokeRouter(postRouter(store), {
    method: "POST",
    path: "/posts",
    body: { content: "Hello" },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Missing or invalid token" });
});

test("a blank post leaves posts.json unchanged", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [storedPost],
  });

  const response = await invokeRouter(postRouter(store), {
    method: "POST",
    path: "/posts",
    headers: bearerFor(shopper),
    body: { content: "  " },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { message: "Post content is required" });
  assert.deepEqual(store.files["posts.json"], [storedPost]);
});

test("a post with content is stored first", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [storedPost],
  });

  const response = await invokeRouter(postRouter(store), {
    method: "POST",
    path: "/posts",
    headers: bearerFor(shopper),
    body: { content: "Hello" },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.content, "Hello");
  assert.equal(store.files["posts.json"][0].content, "Hello");
  assert.equal(store.files["posts.json"][1].id, "post-01");
});
