/**
 * Renders one post card, including its like button.
 * Role: Renders purely from props — `likes`/`likedByCurrentUser` come straight from the
 *   `post` object the host passes down (freshly patched after every community-likes/changed;
 *   see apps/social-media-shell/src/pages/feedPage.js, postsPage.js, accountPage.js) — and
 *   announces community-likes/watching for this post on mount so the host keeps receiving
 *   those patches in the first place.
 * Not in this file: The feed list, mount lifecycle, or empty state (src/post-feed.js). The
 *   like toggle write and the "Post Liked" toast
 *   (apps/social-media-shell/src/commands/postLikeCommands.js), reached indirectly: a click
 *   here only publishes the local community/post-liked intent, never calls the gateway itself.
 * Key dependencies: react; event-mesh/mesh singleton; @shared/community-events.
 * See also: apps/social-media-shell/src/commands/postLikeCommands.js;
 *   apps/social-media-shell/src/events/communityLikesLiveEvents.js;
 *   MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import React, { useEffect } from "react";
import mesh from "event-mesh/mesh";
import { createCommunityEvents } from "@shared/community-events";

const { publishPostLiked, publishPostLikesWatching, publishAuthorSelected } =
  createCommunityEvents({ mesh });

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
 * @param {{ post: object, layoutMode?: string, onPostClick?: (post: object) => void, currentUserId?: string }} cardProps - Post data, an optional card click handler, and the viewer's id (absent for a guest).
 */
function PostCardView({ post, layoutMode, onPostClick, currentUserId }) {
  const author = post.author || {};
  const authorDisplayName = author.fullName || author.username || "Unknown user";
  const cardClassName = [
    layoutMode === "grid" ? "post-card post-card-grid" : "post-card",
    typeof onPostClick === "function" ? "post-card-clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Announces watching once per mounted card. Not re-announced on every like-count patch:
  // the post id a card renders never changes while it stays mounted, so there is nothing new
  // to tell the gateway.
  useEffect(() => {
    publishPostLikesWatching(post.id);
  }, [post.id]);

  const isOwnPost = Boolean(currentUserId) && currentUserId === author.id;
  const isLikeDisabled = !currentUserId || isOwnPost;
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
    publishAuthorSelected(author);
  };

  const handleLikeClick = (clickEvent) => {
    clickEvent.stopPropagation();
    if (isLikeDisabled) {
      return;
    }
    publishPostLiked(post.id);
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
          className={`post-card-action${post.likedByCurrentUser ? " post-card-action-liked" : ""}`}
          onClick={handleLikeClick}
          disabled={isLikeDisabled}
          title={likeButtonTitle}
        >
          {post.likedByCurrentUser ? "Liked" : "Like"} ({post.likes || 0})
        </button>
        <span className="post-card-comments">Comments: {post.comments || 0}</span>
      </footer>
    </article>
  );
}

export { PostCardView, formatPostDate };
