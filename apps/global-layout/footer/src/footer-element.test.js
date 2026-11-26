/**
 * Verifies the footer custom element is registered once.
 * Role: Locks that a second register call keeps the first definition.
 * Not in this file: Footer rendering, which needs a shadow root the unit DOM does not model.
 * Key dependencies: node:test; src/footer-element.js; test/support/installCustomElements.js.
 * See also: src/footer-element.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../../test/support/installDomDocument.js";
import { installCustomElements } from "../../../../test/support/installCustomElements.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

installDomDocument();
const { registry } = installCustomElements();
const { registerFooterElement } = await loadAppModule(new URL("./footer-element.js", import.meta.url).href);

test("registering twice defines the footer once", () => {
  registerFooterElement();
  const firstClass = customElements.get("vue-footer-mfe");
  registerFooterElement();

  assert.equal(typeof firstClass, "function");
  assert.equal(customElements.get("vue-footer-mfe"), firstClass);
  assert.deepEqual([...registry.keys()], ["vue-footer-mfe"]);
});
