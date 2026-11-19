/**
 * Verifies the FAQ iframe host builds a FAQ url and clears itself on cleanup.
 * Role: Locks the iframe markup both comparison branches write for a named shopper.
 * Not in this file: How a submitted FAQ is delivered to the shell.
 * Key dependencies: node:test; src/faq-formulary.js.
 * See also: src/faq-formulary.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

globalThis.__webpack_public_path__ = "http://localhost/";

const { mountFaqFormulary } = await loadAppModule(
  new URL("./faq-formulary.js", import.meta.url).href,
);

/**
 * Builds a container that records innerHTML and returns one iframe.
 *
 * @returns {{ container: object, iframe: { style: object } }} Mount target.
 */
function createFaqContainer() {
  const iframe = { style: {} };
  const container = {
    lastHtml: "",
    querySelector() {
      return iframe;
    },
  };
  Object.defineProperty(container, "innerHTML", {
    get() {
      return container.lastHtml;
    },
    set(value) {
      container.lastHtml = String(value);
    },
  });
  return { container, iframe };
}

test("mounts an FAQ iframe for a named shopper and clears it on cleanup", () => {
  const { container, iframe } = createFaqContainer();
  const unmount = mountFaqFormulary(container, {
    userName: "Ada",
    userEmail: "ada@example.com",
  });

  assert.match(container.innerHTML, /faq-formulary\.html/);
  assert.match(container.innerHTML, /type=faq/);
  assert.match(container.innerHTML, /name=Ada/);
  assert.match(container.innerHTML, /email=/);
  assert.equal(iframe.style.height, "0px");

  unmount();
  assert.equal(container.innerHTML, "");
});
