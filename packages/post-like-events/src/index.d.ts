export declare const POST_LIKES_CHANGED_EVENT_NAME: string;

export declare const POST_LIKES_STREAM_PATH: string;

export type PostLikesChangedEvent = {
  postId: string;
  likes: number;
  ownerId: string;
  likerId: string;
  likerName: string;
  liked: boolean;
};

export declare function subscribeToPostLikesChanged(
  apiBaseUrl: string,
  listener: (event: PostLikesChangedEvent) => void,
): () => void;

export declare function togglePostLike(input: {
  apiBaseUrl: string;
  authToken: string;
  postId: string;
}): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; code: string }>;
