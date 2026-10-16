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

export declare function subscribeToPostLikesChanged(
  apiBaseUrl: string,
  listener: (event: PostLikesChangedEvent) => void,
): () => void;

export declare function subscribeToPostCreated(
  apiBaseUrl: string,
  listener: (post: CreatedPost) => void,
): () => void;

export declare function togglePostLike(input: {
  apiBaseUrl: string;
  authToken: string;
  postId: string;
}): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; code: string }>;
