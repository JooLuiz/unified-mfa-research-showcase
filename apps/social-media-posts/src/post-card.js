/**
 * Renders one post card, including its like button.
 * Role: Owns the card's local like state so a click shows the server's result instantly,
 *   without waiting for the host to re-render the whole feed; reconciles that local state
 *   whenever the host passes a fresh `post` (for example after a live SSE-driven update).
 * Not in this file: The feed list, mount lifecycle, or empty state (src/post-feed.js). The
 *   like HTTP call itself: `onLike` is a host-owned callback (see feedPage.js/postsPage.js/
 *   accountPage.js in apps/social-media-shell), since this remote has no `@shared/*`
 *   dependency of its own today.
 * Key dependencies: react.
 * See also: apps/social-media-shell/src/commands/postLikeCommands.js.
 */

import React, { useEffect, useState } from "react";

function formatPostDate(isoDateString) {
  if (!isoDateString) {
    return "";
  }
  const dateValue = new Date(isoDateString);
  if (Number.isNaN(dateValue.getTime())) {
    return isoDateString;
  }
  return dateValue.toLocaleString();
}

/**
 * Renders one post card.
 *
 * @param {{ post: object, layoutMode?: string, onLike?: (postId: string) => Promise<{ liked: boolean, likes: number } | null>, onAuthorClick?: (author: object) => void, onPostClick?: (post: object) => void, currentUserId?: string }} cardProps - Post data, the host's like/author/post-click callbacks, and the viewer's id (absent for a guest).
 */
function PostCardView({ post, layoutMode, onLike, onAuthorClick, onPostClick, currentUserId }) {
  const author = post.author || {};
  const authorDisplayName = author.fullName || author.username || "Unknown user";
  const cardClassName = [
    layoutMode === "grid" ? "post-card post-card-grid" : "post-card",
    typeof onPostClick === "function" ? "post-card-clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const [likeState, setLikeState] = useState({
    likes: post.likes || 0,
    likedByCurrentUser: Boolean(post.likedByCurrentUser),
  });
  const [isTogglingLike, setIsTogglingLike] = useState(false);

  // Reconciles this card's local like state whenever the host passes a fresh post (its own
  // optimistic patch above already matches; this also picks up changes made by other viewers,
  // reconciled by the host from the live stream).
  useEffect(() => {
    setLikeState({
      likes: post.likes || 0,
      likedByCurrentUser: Boolean(post.likedByCurrentUser),
    });
  }, [post.likes, post.likedByCurrentUser]);

  const isOwnPost = Boolean(currentUserId) && currentUserId === author.id;
  const isLikeDisabled = !currentUserId || isOwnPost || isTogglingLike;
  const likeButtonTitle = !currentUserId
    ? "Sign in to like posts"
    : isOwnPost
      ? "You cannot like your own post"
      : undefined;

  const handleCardClick = () => {
    if (typeof onPostClick === "function") {
      onPostClick(post);
    }
  };

  const handleAuthorClick = (clickEvent) => {
    clickEvent.stopPropagation();
    if (onAuthorClick) {
      onAuthorClick(author);
    }
  };

  const handleLikeClick = async (clickEvent) => {
    clickEvent.stopPropagation();
    if (isLikeDisabled || !onLike) {
      return;
    }
    setIsTogglingLike(true);
    try {
      const toggleResult = await onLike(post.id);
      if (toggleResult) {
        setLikeState({ likes: toggleResult.likes, likedByCurrentUser: toggleResult.liked });
      }
    } finally {
      setIsTogglingLike(false);
    }
  };

  return (
    <article className={cardClassName} onClick={handleCardClick}>
      <header className="post-card-header">
        {author.avatarUrl && (
          <img
            className="post-card-avatar"
            src={author.avatarUrl}
            alt={`${authorDisplayName} avatar`}
            onClick={handleAuthorClick}
          />
        )}
        <div className="post-card-author">
          <button
            type="button"
            className="post-card-author-button"
            onClick={handleAuthorClick}
          >
            <strong>{authorDisplayName}</strong>
          </button>
          <span className="post-card-date">{formatPostDate(post.createdAt)}</span>
        </div>
      </header>
      <p className="post-card-content">{post.content}</p>
      {post.imageUrl && (
        <img className="post-card-image" src={post.imageUrl} alt="Post visual" />
      )}
      <footer className="post-card-footer">
        <button
          type="button"
          className={`post-card-action${likeState.likedByCurrentUser ? " post-card-action-liked" : ""}`}
          onClick={handleLikeClick}
          disabled={isLikeDisabled}
          title={likeButtonTitle}
        >
          {likeState.likedByCurrentUser ? "Liked" : "Like"} ({likeState.likes})
        </button>
        <span className="post-card-comments">Comments: {post.comments || 0}</span>
      </footer>
    </article>
  );
}

export { PostCardView, formatPostDate };
