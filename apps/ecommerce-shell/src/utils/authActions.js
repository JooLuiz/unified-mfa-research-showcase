import { publishAuthSessionChanged } from "../events/eventBus";
import {
  readStoredAuthRecord,
  storePostLoginRedirect,
  takePostLoginRedirect,
  writeStoredAuthRecord,
} from "../notifications/sessionState";
import { MOCK_API_BASE_URL } from "./constants";

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
  const storedAuth = readStoredAuthRecord();
  appState.authToken = storedAuth?.token || null;
  appState.currentUser = storedAuth?.user || null;
}

function persistAuth(appState) {
  writeStoredAuthRecord(appState.authToken, appState.currentUser);
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

function rememberPostLoginRedirect(redirectPath) {
  storePostLoginRedirect(redirectPath);
}

function consumePostLoginRedirect() {
  return takePostLoginRedirect();
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
