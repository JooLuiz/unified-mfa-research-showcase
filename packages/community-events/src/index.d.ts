export type PostLikedRequest = {
  postId: string;
};

export type AuthorSelectedRequest = {
  author: object;
};

export type PostSubmittedRequest = {
  content: string;
  imageUrl: string;
};

export type FaqSubmittedRequest = {
  name: string;
  email: string;
  contactMethod: string;
  question: string;
};

export type CommunityMeshClient = {
  publish(input: object): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload: unknown }) => void,
  ): () => void;
  whenConnected(options?: { timeoutMs?: number }): Promise<void>;
};

export type CommunityIntentHandlers = {
  onPostLiked?(payload: PostLikedRequest): void;
  onAuthorSelected?(payload: AuthorSelectedRequest): void;
  onPostSubmitted?(payload: PostSubmittedRequest): void;
  onFaqSubmitted?(payload: FaqSubmittedRequest): void;
};

export type CommunityEvents = {
  publishPostLiked(postId: string): void;
  publishPostLikesWatching(postId: string): void;
  publishAuthorSelected(author: object): void;
  publishPostSubmitted(post: PostSubmittedRequest): void;
  publishFaqSubmitted(faq: FaqSubmittedRequest): void;
  ensureCommunityIntentListeners(handlers: CommunityIntentHandlers): void;
  resetCommunityIntentListeners(): void;
};

export declare const COMMUNITY_TOPIC: "community";
export declare const COMMUNITY_POST_LIKED_EVENT: "post-liked";
export declare const COMMUNITY_AUTHOR_SELECTED_EVENT: "author-selected";
export declare const COMMUNITY_POST_SUBMITTED_EVENT: "post-submitted";
export declare const COMMUNITY_FAQ_SUBMITTED_EVENT: "faq-submitted";
export declare const COMMUNITY_LIKES_TOPIC: "community-likes";
export declare const COMMUNITY_LIKES_WATCHING_EVENT: "watching";
export declare const COMMUNITY_LIKES_TOGGLE_EVENT: "toggle";
export declare const COMMUNITY_LIKES_ACCEPTED_EVENT: "accepted";
export declare const COMMUNITY_LIKES_REJECTED_EVENT: "rejected";
export declare const COMMUNITY_LIKES_CHANGED_EVENT: "changed";

export function isValidPostLikedRequest(
  value: unknown,
): value is PostLikedRequest;
export function isValidAuthorSelectedRequest(
  value: unknown,
): value is AuthorSelectedRequest;
export function isValidPostSubmittedRequest(
  value: unknown,
): value is PostSubmittedRequest;
export function isValidFaqSubmittedRequest(
  value: unknown,
): value is FaqSubmittedRequest;
export function createPostSubmittedRequest(
  value: unknown,
): PostSubmittedRequest | null;
export function createFaqSubmittedRequest(
  value: unknown,
): FaqSubmittedRequest | null;

export function createCommunityEvents(input: {
  mesh: CommunityMeshClient;
}): CommunityEvents;
