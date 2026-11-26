export type ShellMeshClient = {
  publish(input: object): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: { path?: string } }) => void,
  ): () => void;
};

export type ShellIntentHandlers = {
  onRenderRequested(): void;
  onPathRequested(payload: { path: string }): void;
  onAuthSessionChanged(): void;
  onLogoutRequested(): void;
};

export type ShellEvents = {
  publishRenderRequested(): void;
  publishPathRequested(path: string): void;
  publishPostLoginRedirectChanged(path: string | null): void;
  publishAuthSessionChanged(): void;
  publishLogoutRequested(): void;
  ensureShellEventListeners(handlers: ShellIntentHandlers): void;
  resetShellEventListeners(): void;
  subscribeToAuthSessionChanges(listener: () => void): () => void;
  subscribeToRenderRequests(listener: () => void): () => void;
};

export declare const AUTH_TOPIC: "auth";
export declare const AUTH_SESSION_CHANGED_EVENT: "session-changed";
export declare const AUTH_LOGOUT_REQUESTED_EVENT: "logout-requested";
export declare const NAVIGATION_TOPIC: "navigation";
export declare const NAVIGATION_RENDER_REQUESTED_EVENT: "render-requested";
export declare const NAVIGATION_PATH_REQUESTED_EVENT: "path-requested";
export declare const NAVIGATION_POST_LOGIN_REDIRECT_CHANGED_EVENT: "post-login-redirect-changed";

export function createShellEvents(input: ShellMeshClient): ShellEvents;

export const SESSION_MODE_IDLE: "idle";
export const SESSION_MODE_GUEST: "guest";
export const SESSION_MODE_AUTHENTICATED: "authenticated";

export interface SessionChannel {
  connectGuest(): void;
  connectAuthenticated(): void;
  disconnect(): void;
}

export interface AuthSessionHooks {
  isAuthenticated(): boolean;
  attachListeners?(): void;
  detachListeners?(): void;
  startLiveEvents?(): void;
  stopLiveEvents?(): void;
  onGuestReady?(): void;
}

export interface AuthSessionLifecycle {
  start(): void;
  sync(): void;
  getMode(): "idle" | "guest" | "authenticated";
}

export function createAuthSessionLifecycle(
  channel: SessionChannel,
  hooks: AuthSessionHooks,
): AuthSessionLifecycle;

export interface RenderedSessionMarker {
  beginRender(): number;
  isLatestRender(renderId: number): boolean;
  remember(renderId?: number): void;
  isSameSignedInUser(): boolean;
}

export function createRenderedSessionMarker(appState: {
  authToken?: string | null;
  currentUser?: { id?: string } | null;
}): RenderedSessionMarker;
