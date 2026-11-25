/**
 * Verifies the FAQ submission route against an in-memory store.
 * Role: Asserts what a valid submission stores and that an incomplete one stores nothing.
 * Not in this file: The FAQ form UI (apps/formulary).
 * Key dependencies: node:test; src/routes/faqRoutes.js; test/invokeRouter.js.
 * See also: src/routes/faqRoutes.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createFaqRouter } = require("./faqRoutes");
const {
  bearerFor,
  createFailingJsonStore,
  createMemoryJsonStore,
  invokeRouter,
} = require("../../test/invokeRouter");

const validationMessage = { message: "Name, email, and question are required" };

test("a FAQ request with no body is rejected and stores nothing", async () => {
  const store = createMemoryJsonStore({});

  const response = await invokeRouter(createFaqRouter(store), {
    method: "POST",
    path: "/faq",
    parseJson: false,
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, validationMessage);
  assert.equal(store.files["faq-answers.json"], undefined);
});

test("a FAQ request with non-string fields is rejected and stores nothing", async () => {
  const store = createMemoryJsonStore({});

  const response = await invokeRouter(createFaqRouter(store), {
    method: "POST",
    path: "/faq",
    body: { name: 1, email: "ada@example.com", question: "Where?" },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, validationMessage);
  assert.equal(store.files["faq-answers.json"], undefined);
});

test("an anonymous FAQ submission is stored with trimmed values and no user", async () => {
  const store = createMemoryJsonStore({});

  const response = await invokeRouter(createFaqRouter(store), {
    method: "POST",
    path: "/faq",
    body: { name: " Ada ", email: " ada@example.com ", question: " Where? " },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.name, "Ada");
  assert.equal(response.body.contactMethod, "");
  assert.equal(response.body.submittedByUserId, null);
  assert.equal(store.files["faq-answers.json"].length, 1);
});

test("a signed-in FAQ submission records the user", async () => {
  const store = createMemoryJsonStore({ "faq-answers.json": [] });

  const response = await invokeRouter(createFaqRouter(store), {
    method: "POST",
    path: "/faq",
    headers: bearerFor({ id: "u-01" }),
    body: { name: "Ada", email: "ada@example.com", question: "Where?", contactMethod: " email " },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.contactMethod, "email");
  assert.equal(store.files["faq-answers.json"][0].submittedByUserId, "u-01");
});

test("an unwritable FAQ file returns 500", async () => {
  const store = createFailingJsonStore({}, { failOnWrite: ["faq-answers.json"] });

  const response = await invokeRouter(createFaqRouter(store), {
    method: "POST",
    path: "/faq",
    body: { name: "Ada", email: "ada@example.com", question: "Where?" },
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.message, "Unable to save FAQ answer");
  assert.equal(store.files["faq-answers.json"], undefined);
});
