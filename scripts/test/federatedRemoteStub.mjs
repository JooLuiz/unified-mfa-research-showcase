/**
 * Stand-in for social shell remote modules during unit tests.
 * Role: Supplies the register and mount functions pageApps.js expects from federated remotes.
 * Not in this file: Real micro-frontend rendering.
 * Key dependencies: globalThis.__federatedRemoteCleanup, set by the page lifecycle test.
 * See also: scripts/test/federatedRemoteResolver.mjs.
 */

/**
 * Returns the cleanup the current test configured, or a no-op.
 *
 * @returns {(() => void) | undefined} Cleanup passed back to the page lifecycle.
 */
function cleanupFromTest() {
  if (globalThis.__federatedRemoteCleanup === "not-a-function") {
    return undefined;
  }
  if (typeof globalThis.__federatedRemoteCleanup === "function") {
    return globalThis.__federatedRemoteCleanup;
  }
  return function remoteCleanup() {};
}

function registerHeaderElement() {}

function registerFooterElement() {}

function registerProductShowcaseElement() {}

function mountPromotionalBanner() {
  return cleanupFromTest();
}

function mountNewPostFormulary() {
  return cleanupFromTest();
}

function mountPostFeed() {
  return cleanupFromTest();
}

function mountLoginForm() {
  return cleanupFromTest();
}

function mountNotificationBell() {
  return cleanupFromTest();
}

function mountNotificationsPage() {
  return cleanupFromTest();
}

function mountSinglePost() {
  return cleanupFromTest();
}

function mountAccountProfile(_element, props) {
  globalThis.__mountedAccountProfile = props;
  return cleanupFromTest();
}

function mountAccountAddress(_element, props) {
  globalThis.__mountedAccountAddress = props;
  return cleanupFromTest();
}

export {
  mountAccountAddress,
  mountAccountProfile,
  mountLoginForm,
  mountNewPostFormulary,
  mountNotificationBell,
  mountNotificationsPage,
  mountPostFeed,
  mountPromotionalBanner,
  mountSinglePost,
  registerFooterElement,
  registerHeaderElement,
  registerProductShowcaseElement,
};
