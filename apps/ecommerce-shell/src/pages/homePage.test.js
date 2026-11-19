/**
 * Verifies the ecommerce home page mounts its sections and the FAQ frame.
 * Role: Locks the banner, showcase, FAQ, and notice a shopper sees on home.
 * Not in this file: Iframe resize delivery.
 * Key dependencies: node:test; src/pages/homePage.js; test/support/createPageDocument.js.
 * See also: src/pages/homePage.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  createRemoteRecorder,
  installPageDocument,
  latestRemoteCall,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderHomePage } = await loadAppModule(new URL("./homePage.js", import.meta.url).href);

/**
 * Builds home state with one banner and one showcase.
 *
 * @param {object} extra - Fields that change the FAQ and notice.
 * @returns {object} Shell state.
 */
function createHomeState(extra) {
  return {
    banners: [{ id: "banner-01" }],
    showcases: [{ id: "showcase-01" }],
    currentUser: { fullName: "Ada Lovelace", email: "ada@example.com" },
    isFormularySubmitted: false,
    lastIframeMessage: "",
    ...extra,
  };
}

test("mounts the banner, showcase, and FAQ frame", async () => {
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const cleanups = [];
  await renderHomePage(createHomeState(), pageRoot, remotes, cleanups);

  assert.equal(latestRemoteCall(remotes, "banner").props.bannerId, "banner-01");
  assert.equal(latestRemoteCall(remotes, "showcase").props.showcaseId, "showcase-01");
  const faqFrame = pageRoot.querySelector("iframe");
  assert.equal(faqFrame.getAttribute("title"), "FAQ Formulary");
  assert.equal(faqFrame.getAttribute("src").includes("faq-formulary.html"), true);
  assert.equal(faqFrame.getAttribute("src").includes("type=faq"), true);

  cleanups.forEach((cleanup) => cleanup());
  assert.equal(pageRoot.querySelector("iframe"), null);
});

test("shows the sent state and the latest iframe message", async () => {
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  await renderHomePage(
    createHomeState({
      currentUser: null,
      isFormularySubmitted: true,
      lastIframeMessage: "Hello from the form",
    }),
    pageRoot,
    remotes,
    [],
  );
  assert.equal(latestRemoteCall(remotes, "formularySent") !== undefined, true);
  assert.equal(pageRoot.querySelector("iframe"), null);
  assert.match(pageRoot.textContent, /Latest iframe message: Hello from the form/);
});
