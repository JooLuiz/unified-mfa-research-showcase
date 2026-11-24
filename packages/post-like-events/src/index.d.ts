export declare const POST_LIKES_CHANGED_EVENT_NAME: string;

export declare const POST_CREATED_EVENT_NAME: string;

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

export declare function subscribeToPostLikesChanged(
  transport: { subscribe: PostLikeTransport["subscribe"] },
  listener: (event: PostLikesChangedEvent) => void,
): () => void;

export declare function subscribeToPostCreated(
  transport: { subscribe: PostLikeTransport["subscribe"] },
  listener: (post: CreatedPost) => void,
): () => void;

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

export declare function togglePostLike(
  transport: {
    request(message: {
      topic: string;
      event: string;
      payload?: { postId?: string };
    }): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; code: string }>;
  },
  input: { postId: string },
): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; code: string }>;
