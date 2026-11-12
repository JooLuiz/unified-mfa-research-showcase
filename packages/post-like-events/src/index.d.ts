export declare const POST_LIKES_CHANGED_EVENT_NAME: string;

export declare const POST_CREATED_EVENT_NAME: string;

export declare const POST_LIKES_STREAM_PATH: string;

export type PostLikesChangedEvent = {
  postId: string;
  likes: number;
  ownerId: string;
  likerId: string;
  likerName: string;
  liked: boolean;
};

export type CreatedPost = {
  id: string;
  authorId: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  likes: number;
  comments: number;
  author: { id: string; username?: string; fullName?: string; avatarUrl?: string } | null;
};

export declare function startPostLikesLiveEvents(): Promise<void>;

export declare function stopPostLikesLiveEvents(): void;

export declare function subscribeToPostLikesChanged(
  listener: (event: PostLikesChangedEvent) => void,
): () => void;

export declare function subscribeToPostCreated(
  listener: (post: CreatedPost) => void,
): () => void;

export declare function applyLikesChangeToPosts(
  posts: CreatedPost[],
  viewerUserId: string | null | undefined,
  payload: { postId: string; likes: number; likerId: string; liked: boolean },
): CreatedPost[];

export type PostLikeTransport = {
  subscribe: (
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ) => () => void;
};

export type PostLikeEvents = {
  subscribeToLikeChanges: (listener: (likeEvent: PostLikesChangedEvent) => void) => () => void;
  subscribeToPostCreated: (listener: (post: CreatedPost) => void) => () => void;
};

export declare function createPostLikeEvents(transport: PostLikeTransport): PostLikeEvents;

export declare function togglePostLike(input: {
  apiBaseUrl?: string;
  authToken: string;
  postId: string;
}): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; code: string }>;

export declare function resetToggleListeners(): void;
