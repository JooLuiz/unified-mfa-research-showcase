/**
 * Renders one post with a like button.
 * Role: Publishes the local like intent and community-likes/watching, and patches the count
 *   from community-likes/changed. The host shell performs the gateway toggle.
 * Not in this file: The toggle request/reply (the host's postLikeCommands) or post loading
 *   (src/SinglePostView.js).
 * Key dependencies: event-mesh/mesh; @shared/community-events.
 * See also: apps/social-media-posts/src/post-card.js.
 */

import React, { useState, useEffect } from "react";
import mesh from "event-mesh/mesh";
import { createCommunityEvents } from "@shared/community-events";

const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_CHANGED_EVENT = "changed";

const { publishPostLiked, publishPostLikesWatching } = createCommunityEvents({ mesh });

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
 * Renders a single post card.
 *
 * @param {{ post: object, currentUserId?: string, canLike?: boolean }} cardProps - Post data, the viewer id, and whether this host allows likes.
 * @returns {import("react").ReactElement} The post card.
 */
export function SinglePostCard({ post, currentUserId, canLike = true }) {
  const author = post.author || {};
  const authorName = author.fullName || author.username || "Unknown Author";

  const [likeState, setLikeState] = useState({
    likes: post.likes || 0,
    liked: Boolean(post.likedByCurrentUser),
  });

  useEffect(() => {
    setLikeState({
      likes: post.likes || 0,
      liked: Boolean(post.likedByCurrentUser),
    });
  }, [post.likes, post.likedByCurrentUser]);

  useEffect(() => {
    publishPostLikesWatching(post.id);
    const unsubscribe = mesh.subscribe(COMMUNITY_LIKES_TOPIC, COMMUNITY_LIKES_CHANGED_EVENT, (message) => {
      const event = message.payload;
      if (!event || event.postId !== post.id) {
        return;
      }
      setLikeState((previousState) => ({
        likes: typeof event.likes === "number" ? event.likes : previousState.likes,
        liked: event.likerId === currentUserId ? Boolean(event.liked) : previousState.liked,
      }));
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [post.id, currentUserId]);

  const isOwnPost = Boolean(currentUserId) && currentUserId === author.id;
  const isLikeDisabled = !currentUserId || isOwnPost || !canLike;

  const handleLike = () => {
    if (isLikeDisabled) {
      return;
    }
    publishPostLiked(post.id);
  };

  return (
    <div className="single-post-card">
      <header className="single-post-header">
        {author.avatarUrl && (
          <img
            className="single-post-avatar"
            src={author.avatarUrl}
            alt={authorName}
          />
        )}
        <div className="single-post-author-meta">
          <span className="single-post-author-name">{authorName}</span>
          <span className="single-post-date">{formatPostDate(post.createdAt)}</span>
        </div>
      </header>

      <p className="single-post-content">{post.content}</p>

      {post.imageUrl && (
        <img
          className="single-post-image"
          src={post.imageUrl}
          alt="Post media"
        />
      )}

      <footer className="single-post-footer">
        <button
          type="button"
          className={`single-post-like-button${likeState.liked ? " liked" : ""}`}
          onClick={handleLike}
          disabled={isLikeDisabled}
        >
          {likeState.liked ? "Liked" : "Like"} ({likeState.likes})
        </button>
        <span className="single-post-comments-count">
          Comments: {post.comments || 0}
        </span>
      </footer>
    </div>
  );
}
