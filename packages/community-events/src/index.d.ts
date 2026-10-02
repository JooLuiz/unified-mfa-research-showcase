export const COMMUNITY_TOPIC: string;
export const POST_SUBMITTED_EVENT: string;

export interface CommunityTransport {
  publish(message: { topic: string; event: string; payload?: object; scope: string }): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ): () => void;
}

export interface CommunityEvents {
  publishPostSubmitted(payload?: object): void;
  subscribeToPostSubmitted(listener: (payload: unknown) => void): () => void;
}

export function createCommunityEvents(transport: CommunityTransport): CommunityEvents;
