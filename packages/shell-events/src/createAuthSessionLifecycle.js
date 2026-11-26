/**
 * Moves a shell between its guest and signed-in sessions.
 * Role: Owns the session mode and the order of connect, listener, and live-event steps.
 * Not in this file: How a session connects. The shell's src/events/eventBus.js supplies the channel.
 * Key dependencies: None. Every collaborator is injected.
 * See also: apps/ecommerce-shell/src/main.js; src/createAuthSessionLifecycle.test.js.
 */

const SESSION_MODE_IDLE = "idle";
const SESSION_MODE_GUEST = "guest";
const SESSION_MODE_AUTHENTICATED = "authenticated";

/**
 * Returns a no-op so optional lifecycle hooks can be called unconditionally.
 *
 * @returns {void}
 */
function doNothing() {}

/**
 * Creates the guest and signed-in session lifecycle for one shell.
 *
 * @param {{ connectGuest: () => void, connectAuthenticated: () => void, disconnect: () => void }} channel
 *   - Session connection steps. They may be no-ops when the shell needs no connection.
 * @param {{
 *   isAuthenticated: () => boolean,
 *   attachListeners?: () => void,
 *   detachListeners?: () => void,
 *   startLiveEvents?: () => void,
 *   stopLiveEvents?: () => void,
 *   onGuestReady?: () => void,
 * }} hooks - Shell steps run on each transition.
 * @returns {{ start: () => void, sync: () => void, getMode: () => string }} Lifecycle controls.
 */
function createAuthSessionLifecycle(channel, hooks) {
  const isAuthenticated = hooks.isAuthenticated;
  const attachListeners = hooks.attachListeners || doNothing;
  const detachListeners = hooks.detachListeners || doNothing;
  const startLiveEvents = hooks.startLiveEvents || doNothing;
  const stopLiveEvents = hooks.stopLiveEvents || doNothing;
  const onGuestReady = hooks.onGuestReady || doNothing;
  let mode = SESSION_MODE_IDLE;

  /**
   * Detaches listeners, stops live events, and drops the current connection.
   *
   * @returns {void}
   */
  function tearDown() {
    detachListeners();
    stopLiveEvents();
    channel.disconnect();
    mode = SESSION_MODE_IDLE;
  }

  /**
   * Opens the guest session unless a signed-in session is active.
   *
   * @returns {void}
   */
  function startGuest() {
    if (mode === SESSION_MODE_AUTHENTICATED) {
      return;
    }
    if (mode === SESSION_MODE_IDLE) {
      channel.connectGuest();
      mode = SESSION_MODE_GUEST;
    }
    attachListeners();
    onGuestReady();
  }

  /**
   * Opens the signed-in session, or refreshes it when it is already open.
   *
   * @returns {void}
   */
  function startAuthenticated() {
    if (mode !== SESSION_MODE_AUTHENTICATED) {
      tearDown();
      channel.connectAuthenticated();
      mode = SESSION_MODE_AUTHENTICATED;
    }
    attachListeners();
    startLiveEvents();
  }

  return {
    start() {
      if (isAuthenticated()) {
        startAuthenticated();
        return;
      }
      startGuest();
    },
    sync() {
      if (isAuthenticated()) {
        startAuthenticated();
        return;
      }
      tearDown();
      startGuest();
    },
    getMode() {
      return mode;
    },
  };
}

export {
  createAuthSessionLifecycle,
  SESSION_MODE_AUTHENTICATED,
  SESSION_MODE_GUEST,
  SESSION_MODE_IDLE,
};
