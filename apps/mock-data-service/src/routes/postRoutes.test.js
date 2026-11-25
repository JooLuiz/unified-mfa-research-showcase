/**
 * Verifies the post HTTP routes against an in-memory store.
 * Role: Asserts the listed posts, what creating a post stores, and the 401, 404, and 500
 *   responses.
 * Not in this file: Post likes.
 * Key dependencies: node:test; src/routes/postRoutes.js; test/invokeRouter.js.
 * See also: src/domain/postLikes.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPostRouter } = require("./postRoutes");
const {
  bearerFor,
  createFailingJsonStore,
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

test("creating a post for an unknown user leaves posts.json unchanged", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [storedPost],
  });

  const response = await invokeRouter(postRouter(store), {
    method: "POST",
    path: "/posts",
    headers: bearerFor({ ...shopper, id: "ghost-01" }),
    body: { content: "Hi" },
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "User not found" });
  assert.deepEqual(store.files["posts.json"], [storedPost]);
});

test("unreadable posts return 500 from the post list and the single post", async () => {
  const router = postRouter(
    createFailingJsonStore(
      { "users.json": [shopper], "posts.json": [storedPost] },
      { failOnRead: ["posts.json"] },
    ),
  );

  const listResponse = await invokeRouter(router, { method: "GET", path: "/posts" });
  const singleResponse = await invokeRouter(router, { method: "GET", path: "/posts/post-01" });

  assert.equal(listResponse.status, 500);
  assert.deepEqual(listResponse.body, {
    message: "Unable to load posts",
    details: "Cannot read posts.json",
  });
  assert.equal(singleResponse.status, 500);
  assert.deepEqual(singleResponse.body, {
    message: "Unable to load post",
    details: "Cannot read posts.json",
  });
});

test("an unwritable post file returns 500 and leaves posts.json unchanged", async () => {
  const store = createFailingJsonStore(
    { "users.json": [shopper], "posts.json": [storedPost] },
    { failOnWrite: ["posts.json"] },
  );

  const response = await invokeRouter(postRouter(store), {
    method: "POST",
    path: "/posts",
    headers: bearerFor(shopper),
    body: { content: "Hi" },
  });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    message: "Unable to create post",
    details: "Cannot write posts.json",
  });
  assert.deepEqual(store.files["posts.json"], [storedPost]);
});

test("a post whose author no longer exists is returned with a null author", async () => {
  const orphanPost = { ...storedPost, id: "post-02", authorId: "ghost-01" };
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [orphanPost],
  });

  const listResponse = await invokeRouter(postRouter(store), { method: "GET", path: "/posts" });
  const singleResponse = await invokeRouter(postRouter(store), { method: "GET", path: "/posts/post-02" });

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.items[0].author, null);
  assert.equal(singleResponse.status, 200);
  assert.equal(singleResponse.body.author, null);
});

test("creating a post with no body is rejected and leaves posts.json unchanged", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [storedPost],
  });

  const response = await invokeRouter(postRouter(store), {
    method: "POST",
    path: "/posts",
    headers: bearerFor(shopper),
    parseJson: false,
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { message: "Post content is required" });
  assert.deepEqual(store.files["posts.json"], [storedPost]);
});

test("a post router without a notification inbox still stores the post", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "posts.json": [],
  });
  const stream = silentStream();

  const response = await invokeRouter(createPostRouter(store, stream, stream), {
    method: "POST",
    path: "/posts",
    headers: bearerFor(shopper),
    body: { content: "No inbox", imageUrl: "  " },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.imageUrl, null);
  assert.equal(store.files["posts.json"][0].content, "No inbox");
  assert.equal(store.files["notificationInbox.json"], undefined);
});
