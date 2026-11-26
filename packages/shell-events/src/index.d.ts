export const AUTH_TOPIC: string;
export const AUTH_SESSION_CHANGED_EVENT: string;
export const AUTH_LOGOUT_REQUESTED_EVENT: string;
export const NAVIGATION_TOPIC: string;
export const RENDER_REQUESTED_EVENT: string;

export interface ShellTransportMessage {
  topic: string;
  event: string;
  payload?: object;
  scope: string;
}

export interface ShellTransport {
  publish(message: ShellTransportMessage): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ): () => void;
}

export interface ShellEvents {
  publishRenderRequested(): void;
  subscribeToRenderRequests(listener: () => void): () => void;
  publishAuthSessionChanged(): void;
  subscribeToAuthSessionChanges(listener: () => void): () => void;
  publishLogoutRequested(): void;
  subscribeToLogoutRequests(listener: () => void): () => void;
}

export function createShellEvents(transport: ShellTransport): ShellEvents;

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
