import React, { useState, useEffect } from "react";
import {
  togglePostLike,
  subscribeToPostLikesChanged,
} from "@shared/post-like-events";

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

export function SinglePostCard({
  post,
  apiBaseUrl,
  authToken,
  currentUserId,
  canLike = true,
}) {
  const author = post.author || {};
  const authorName = author.fullName || author.username || "Unknown Author";

  const [likeState, setLikeState] = useState({
    likes: post.likes || 0,
    liked: Boolean(post.likedByCurrentUser),
  });
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    setLikeState({
      likes: post.likes || 0,
      liked: Boolean(post.likedByCurrentUser),
    });
  }, [post.likes, post.likedByCurrentUser]);

  useEffect(() => {
    const unsubscribe = subscribeToPostLikesChanged((event) => {
      if (event && event.postId === post.id) {
        setLikeState((prev) => ({
          likes: typeof event.likes === "number" ? event.likes : prev.likes,
          liked:
            event.likerId === currentUserId ? Boolean(event.liked) : prev.liked,
        }));
      }
    });
    return () => {
      unsubscribe();
    };
  }, [post.id, currentUserId]);

  const isOwnPost = Boolean(currentUserId) && currentUserId === author.id;
  const isLikeDisabled = !currentUserId || isOwnPost || isToggling || !canLike;

  const handleLike = async () => {
    if (isLikeDisabled || !apiBaseUrl || !authToken) {
      return;
    }
    setIsToggling(true);
    try {
      const result = await togglePostLike({
        apiBaseUrl,
        authToken,
        postId: post.id,
      });
      if (result.ok) {
        setLikeState({
          likes: result.likes,
          liked: result.liked,
        });
      }
    } finally {
      setIsToggling(false);
    }
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
