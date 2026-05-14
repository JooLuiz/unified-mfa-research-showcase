import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  POST_LOGIN_REDIRECT_STORAGE_KEY,
  MOCK_API_BASE_URL,
} from "./constants";

const PROTECTED_ROUTE_PATHS = ["/checkout", "/account", "/order-details"];

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
  window.dispatchEvent(new CustomEvent("auth:changed"));
}

function clearAuthSession(appState) {
  appState.authToken = null;
  appState.currentUser = null;
  persistAuth(appState);
  window.dispatchEvent(new CustomEvent("auth:changed"));
}

function isAuthenticated(appState) {
  return Boolean(appState.authToken && appState.currentUser);
}

function isProtectedRoute(pathName) {
  return PROTECTED_ROUTE_PATHS.includes(pathName);
}

function rememberPostLoginRedirect(redirectPath) {
  if (!redirectPath) {
    return;
  }
  sessionStorage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, redirectPath);
}

function consumePostLoginRedirect() {
  const redirectPath = sessionStorage.getItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
  if (redirectPath) {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
  }
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
    window.dispatchEvent(new CustomEvent("auth:changed"));
  } catch (error) {
    console.warn("refreshCurrentUserFromApi - error");
    console.warn(error);
  }
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
};
