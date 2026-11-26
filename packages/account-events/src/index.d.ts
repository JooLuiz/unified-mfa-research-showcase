export const ACCOUNT_TOPIC: string;
export const ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT: string;

export type ProfileSaveRequest = {
  fullName: string;
  gender: string;
};

export function isValidProfileSaveRequest(value: unknown): value is ProfileSaveRequest;

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
