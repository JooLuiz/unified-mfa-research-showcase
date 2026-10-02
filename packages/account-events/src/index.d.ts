export const ACCOUNT_TOPIC: string;
export const PROFILE_UPDATED_EVENT: string;

export interface AccountTransport {
  publish(message: { topic: string; event: string; payload?: object; scope: string }): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ): () => void;
}

export interface AccountEvents {
  publishProfileUpdated(payload?: object): void;
  subscribeToProfileUpdates(listener: (payload: unknown) => void): () => void;
}

export function createAccountEvents(transport: AccountTransport): AccountEvents;
