export const AUTH_TOPIC: string;
export const AUTH_SESSION_CHANGED_EVENT: string;
export const AUTH_LOGOUT_REQUESTED_EVENT: string;
export const SHELL_TOPIC: string;
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
