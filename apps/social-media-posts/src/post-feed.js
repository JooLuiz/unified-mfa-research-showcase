import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

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

function PostCardView({ post, layoutMode, onLike, onAuthorClick }) {
  const author = post.author || {};
  const authorDisplayName = author.fullName || author.username || "Unknown user";
  const cardClassName =
    layoutMode === "grid" ? "post-card post-card-grid" : "post-card";

  return (
    <article className={cardClassName}>
      <header className="post-card-header">
        {author.avatarUrl && (
          <img
            className="post-card-avatar"
            src={author.avatarUrl}
            alt={`${authorDisplayName} avatar`}
            onClick={() => onAuthorClick && onAuthorClick(author)}
          />
        )}
        <div className="post-card-author">
          <button
            type="button"
            className="post-card-author-button"
            onClick={() => onAuthorClick && onAuthorClick(author)}
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
          className="post-card-action"
          onClick={() => onLike && onLike(post.id)}
        >
          Like ({post.likes || 0})
        </button>
        <span className="post-card-comments">Comments: {post.comments || 0}</span>
      </footer>
    </article>
  );
}

function PostFeedView({ posts, title, layoutMode, onLike, onAuthorClick }) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return (
      <section className="post-feed-shell">
        <p>No posts available right now.</p>
      </section>
    );
  }

  const feedListClassName =
    layoutMode === "grid" ? "post-feed-list post-feed-grid" : "post-feed-list";
  const shouldRenderTitle = typeof title === "string" ? title.length > 0 : true;
  const feedTitle = typeof title === "string" ? title : "Latest Posts";

  return (
    <section className="post-feed-shell">
      {shouldRenderTitle && <h2 className="post-feed-title">{feedTitle}</h2>}
      <div className={feedListClassName}>
        {posts.map((post) => (
          <PostCardView
            key={post.id}
            post={post}
            layoutMode={layoutMode}
            onLike={onLike}
            onAuthorClick={onAuthorClick}
          />
        ))}
      </div>
    </section>
  );
}

export function mountPostFeed(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(
    <PostFeedView
      posts={props.posts}
      title={props.title}
      layoutMode={props.layoutMode}
      onLike={props.onLike}
      onAuthorClick={props.onAuthorClick}
    />,
  );

  return () => {
    root.unmount();
  };
}
