import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  POST_LOGIN_REDIRECT_STORAGE_KEY,
  MOCK_API_BASE_URL,
} from "./constants";
import {
  publishAuthSessionChanged,
  publishPostLoginRedirectChanged,
} from "../events/localMeshEventBus";

const PROTECTED_ROUTE_PATHS = ["/checkout", "/account"];
const ORDER_DETAILS_ROUTE_PREFIX = "/order-details/";

function isOrderDetailsRoute(pathName) {
  if (!pathName.startsWith(ORDER_DETAILS_ROUTE_PREFIX)) {
    return false;
  }
  const orderIdSegment = pathName.slice(ORDER_DETAILS_ROUTE_PREFIX.length);
  return Boolean(orderIdSegment) && !orderIdSegment.includes("/");
}

function readStoredAuth(appState) {
  try {
    const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const storedUserRaw = localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!storedToken || !storedUserRaw) {
      appState.authToken = null;
      appState.currentUser = null;
      return;
    }

    const parsedUser = JSON.parse(storedUserRaw);
    appState.authToken = storedToken;
    appState.currentUser = parsedUser;
  } catch (error) {
    console.warn("Unable to parse stored auth", error);
    appState.authToken = null;
    appState.currentUser = null;
  }
}

function persistAuth(appState) {
  if (appState.authToken && appState.currentUser) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, appState.authToken);
    localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify(appState.currentUser),
    );
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

function setAuthSession(appState, sessionPayload) {
  appState.authToken = sessionPayload.token || null;
  appState.currentUser = sessionPayload.user || null;
  persistAuth(appState);
  publishAuthSessionChanged();
}

function clearAuthSession(appState) {
  appState.authToken = null;
  appState.currentUser = null;
  persistAuth(appState);
  publishAuthSessionChanged();
}

function isAuthenticated(appState) {
  return Boolean(appState.authToken && appState.currentUser);
}

function isProtectedRoute(pathName) {
  return PROTECTED_ROUTE_PATHS.includes(pathName) || isOrderDetailsRoute(pathName);
}

/**
 * Remembers where to navigate after a successful login.
 *
 * @param {string} redirectPath - Relative path including optional query string.
 * @returns {void}
 * @sideEffects Writes sessionStorage cache and publishes navigation.post-login-redirect-changed.
 */
function rememberPostLoginRedirect(redirectPath) {
  if (!redirectPath) {
    return;
  }
  sessionStorage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, redirectPath);
  publishPostLoginRedirectChanged(redirectPath);
}

/**
 * Reads and clears the remembered post-login redirect path.
 *
 * @returns {string | null | undefined} Cached redirect path when present.
 * @sideEffects Clears sessionStorage cache and publishes navigation.post-login-redirect-changed with null.
 */
function consumePostLoginRedirect() {
  const redirectPath = sessionStorage.getItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
  if (redirectPath) {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
  }
  publishPostLoginRedirectChanged(null);
  return redirectPath;
}

async function refreshCurrentUserFromApi(appState) {
  if (!appState.authToken) {
    return;
  }
  try {
    const response = await fetch(`${MOCK_API_BASE_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${appState.authToken}`,
      },
    });

    if (!response.ok) {
      clearAuthSession(appState);
      return;
    }

    const refreshedUser = await response.json();
    appState.currentUser = refreshedUser;
    persistAuth(appState);
    publishAuthSessionChanged();
  } catch (error) {
    console.warn("refreshCurrentUserFromApi - error");
    console.warn(error);
  }
}

/**
 * Fetches a one-time mesh connection ticket for the authenticated session.
 *
 * @param {string} authToken - Current Bearer token.
 * @returns {Promise<string>} Plain-text mesh ticket for WebSocket upgrade.
 */
async function fetchMeshConnectionTicket(authToken) {
  const response = await fetch(`${MOCK_API_BASE_URL}/auth/mesh-ticket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `fetchMeshConnectionTicket - request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}

export {
  PROTECTED_ROUTE_PATHS,
  readStoredAuth,
  setAuthSession,
  clearAuthSession,
  isAuthenticated,
  isProtectedRoute,
  rememberPostLoginRedirect,
  consumePostLoginRedirect,
  refreshCurrentUserFromApi,
  fetchMeshConnectionTicket,
};
