export type ProfileSaveRequest = {
  fullName: string;
  gender: string;
};

export type AddressSaveRequest = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type AccountMeshClient = {
  publish(input: object): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload: unknown }) => void,
  ): () => void;
};

export type AccountIntentHandlers = {
  onProfileSaveRequested?(payload: ProfileSaveRequest): void;
  onAddressSaveRequested?(payload: AddressSaveRequest): void;
};

export type AccountEvents = {
  publishProfileSaveRequested(profile: ProfileSaveRequest): void;
  publishAddressSaveRequested(address: AddressSaveRequest): void;
  ensureAccountIntentListeners(handlers: AccountIntentHandlers): void;
  resetAccountIntentListeners(): void;
};

export declare const ACCOUNT_TOPIC: "account";
export declare const ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT: "profile-save-requested";
export declare const ACCOUNT_ADDRESS_SAVE_REQUESTED_EVENT: "address-save-requested";

export function isValidProfileSaveRequest(
  value: unknown,
): value is ProfileSaveRequest;
export function isValidAddressSaveRequest(
  value: unknown,
): value is AddressSaveRequest;
export function createProfileSaveRequest(
  value: unknown,
): ProfileSaveRequest | null;
export function createAddressSaveRequest(
  value: unknown,
): AddressSaveRequest | null;

export function createAccountEvents(input: {
  mesh: AccountMeshClient;
}): AccountEvents;
