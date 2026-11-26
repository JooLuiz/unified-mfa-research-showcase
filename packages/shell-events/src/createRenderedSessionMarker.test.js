/**
 * Verifies the rendered-session marker tells a profile refresh apart from a new sign-in.
 * Role: Locks the same-user check the shells use before re-rendering.
 * Not in this file: Rendering.
 * Key dependencies: node:test; src/createRenderedSessionMarker.js.
 * See also: src/createRenderedSessionMarker.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRenderedSessionMarker } from "./createRenderedSessionMarker.js";

test("the same signed-in user matches after a render, and a different one does not", () => {
  const appState = { authToken: "token-01", currentUser: { id: "user-01" } };
  const marker = createRenderedSessionMarker(appState);

  assert.equal(marker.isSameSignedInUser(), false);
  marker.remember(marker.beginRender());
  assert.equal(marker.isSameSignedInUser(), true);

  appState.currentUser = { id: "user-02" };
  assert.equal(marker.isSameSignedInUser(), false);
});

test("a guest render never matches, even with a user record left over", () => {
  const appState = { authToken: null, currentUser: { id: "user-01" } };
  const marker = createRenderedSessionMarker(appState);

  marker.remember();
  assert.equal(marker.isSameSignedInUser(), false);

  appState.authToken = "token-01";
  appState.currentUser = null;
  marker.remember();
  assert.equal(marker.isSameSignedInUser(), false);
});

test("a superseded render leaves the marker unchanged", () => {
  const appState = { authToken: "token-01", currentUser: { id: "user-01" } };
  const marker = createRenderedSessionMarker(appState);
  marker.remember(marker.beginRender());

  const staleRenderId = marker.beginRender();
  assert.equal(marker.isLatestRender(staleRenderId), true);
  marker.beginRender();
  assert.equal(marker.isLatestRender(staleRenderId), false);
  appState.currentUser = { id: "user-02" };
  marker.remember(staleRenderId);

  assert.equal(marker.isSameSignedInUser(), false);
  appState.currentUser = { id: "user-01" };
  assert.equal(marker.isSameSignedInUser(), true);
});
