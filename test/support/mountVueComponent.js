/**
 * Mounts a Vue component or composable into the fake page document for unit tests.
 * Role: Shared mount helper so Vue tests can change props reactively and unmount without repeating app setup.
 * Not in this file: The fake DOM (installDomDocument.js) or assertions.
 * Key dependencies: vue; test/support/installDomDocument.js.
 * See also: apps/order-details/src/useOrderDetails.test.js; apps/account/src/account-profile.test.js.
 */

import "./installBrowserGlobals.js";
import { installDomDocument } from "./installDomDocument.js";

// Vue's DOM runtime reads `document` once when it loads, so the fake document must exist first.
installDomDocument();
const { createApp, h, nextTick, reactive } = await import("vue");

/**
 * Mounts a component whose props can change after mount.
 *
 * @param {object} component - Vue component definition.
 * @param {object} [props] - Initial props. Changing `state` re-renders the component.
 * @returns {Promise<{ root: object, state: object, unmount: () => void }>} Mount root, reactive props, and unmount.
 * @sideEffects Replaces the global fake document with a fresh one.
 */
export async function mountVueComponent(component, props = {}) {
  const { root } = installDomDocument();
  const state = reactive({ ...props });
  const app = createApp({ render: () => h(component, { ...state }) });
  app.mount(root);
  await nextTick();
  return {
    root,
    state,
    unmount() {
      app.unmount();
    },
  };
}

/**
 * Runs a composable inside a probe component that renders nothing.
 *
 * @param {(props: object) => object} composable - Composable under test. It receives the reactive props.
 * @param {object} [props] - Initial props. Changing `state` is seen by the composable's watchers.
 * @returns {{ read: () => object, state: object, unmount: () => void }} Latest composable result, reactive props, and unmount.
 * @sideEffects Replaces the global fake document with a fresh one.
 */
export function mountVueComposable(composable, props = {}) {
  const { root } = installDomDocument();
  const state = reactive({ ...props });
  let latest = null;
  const app = createApp({
    setup() {
      latest = composable(state);
      return () => null;
    },
  });
  app.mount(root);
  return {
    read() {
      return latest;
    },
    state,
    unmount() {
      app.unmount();
    },
  };
}
