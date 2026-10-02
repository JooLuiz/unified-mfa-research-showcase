/**
 * Reads and writes auth/redirect storage and tracks mesh session lifecycle flags.
 * Role: Single module for storage records and mesh session state in the social media shell.
 * Not in this file: Login requests, logout navigation, or event publication.
 * Key dependencies: Browser localStorage and sessionStorage; src/utils/constants.js storage keys.
 * See also: src/utils/authActions.js; src/main.js.
 */

import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  POST_LOGIN_REDIRECT_STORAGE_KEY,
} from "../utils/constants";

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

/**
 * Reads the stored auth token and user, if both are present and parseable.
 *
 * @returns {{ token: string, user: object } | null} Stored session, or null when missing or invalid.
 */
function readStoredAuthRecord() {
  try {
    const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const storedUserRaw = localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!storedToken || !storedUserRaw) {
      return null;
    }

    return {
      token: storedToken,
      user: JSON.parse(storedUserRaw),
    };
  } catch (error) {
    console.warn("Unable to parse stored auth", error);
    return null;
  }
}

/**
 * Writes or clears the stored auth token and user.
 *
 * @param {string | null} token - Bearer token, or null to clear storage.
 * @param {object | null} user - Public user record, or null to clear storage.
 * @returns {void}
 * @sideEffects Mutates localStorage.
 */
function writeStoredAuthRecord(token, user) {
  if (token && user) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

/**
 * Remembers where to send the user after a successful login.
 *
 * @param {string | null | undefined} redirectPath - Path to restore after login.
 * @returns {void}
 * @sideEffects Writes sessionStorage when a path is provided.
 */
function storePostLoginRedirect(redirectPath) {
  if (!redirectPath) {
    return;
  }
  sessionStorage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, redirectPath);
}

/**
 * Returns and clears the stored post-login redirect path.
 *
 * @returns {string | null} Stored path, or null when none was saved.
 * @sideEffects Removes the redirect key from sessionStorage when present.
 */
function takePostLoginRedirect() {
  const redirectPath = sessionStorage.getItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
  if (redirectPath) {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
  }
  return redirectPath;
}

export {
  clearMeshSessionFlags,
  isAuthenticatedMeshActive,
  isLocalMeshStarted,
  readStoredAuthRecord,
  setAuthenticatedMeshActive,
  setLocalMeshStarted,
  storePostLoginRedirect,
  takePostLoginRedirect,
  writeStoredAuthRecord,
};
