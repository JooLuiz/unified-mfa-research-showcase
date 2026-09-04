/**
 * Tracks local and authenticated mesh session state for shell bootstrap.
 * Role: Shared flags updated by shell main.js during mesh mode switches.
 * Not in this file: Mesh configuration, ticket fetching, or listener registration.
 * Key dependencies: None.
 * See also: src/main.js.
 */

let localMeshStarted = false;
let authenticatedMeshActive = false;

function isLocalMeshStarted() {
  return localMeshStarted;
}

function isAuthenticatedMeshActive() {
  return authenticatedMeshActive;
}

function setLocalMeshStarted(isActive) {
  localMeshStarted = Boolean(isActive);
}

function setAuthenticatedMeshActive(isActive) {
  authenticatedMeshActive = Boolean(isActive);
}

function clearMeshSessionFlags() {
  localMeshStarted = false;
  authenticatedMeshActive = false;
}

export {
  isLocalMeshStarted,
  isAuthenticatedMeshActive,
  setLocalMeshStarted,
  setAuthenticatedMeshActive,
  clearMeshSessionFlags,
};
