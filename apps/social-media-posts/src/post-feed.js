/**
 * Renders a list of post cards and mounts it as a federated module.
 * Role: Owns the feed layout, title, and empty state; delegates each card's markup and like
 *   state to src/post-card.js.
 * Not in this file: Card markup/like state (src/post-card.js) or the host-owned like/author
 *   callbacks themselves (apps/social-media-shell/src/pages/*).
 * Key dependencies: react, react-dom; src/post-card.js.
 * See also: apps/social-media-shell/src/pages/feedPage.js, postsPage.js, accountPage.js.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { PostCardView } from "./post-card";
import "./styles.css";

const DEFAULT_EMPTY_STATE_MESSAGE = "No posts available right now.";

/**
 * Renders the feed list, or an empty-state message when there are no posts.
 *
 * @param {{ posts: object[], title?: string, layoutMode?: string, onLike?: (postId: string) => Promise<object | null>, onAuthorClick?: (author: object) => void, currentUserId?: string, emptyStateMessage?: string }} feedProps - Feed data and host-owned callbacks.
 */
function PostFeedView({
  posts,
  title,
  layoutMode,
  onLike,
  onAuthorClick,
  currentUserId,
  emptyStateMessage,
}) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return (
      <section className="post-feed-shell">
        <p>{emptyStateMessage || DEFAULT_EMPTY_STATE_MESSAGE}</p>
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
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Mounts the post feed into a container element.
 *
 * @param {HTMLElement} containerElement - Element to render into.
 * @param {object} props - See PostFeedView's props.
 * @returns {(() => void) & { update: (nextProps: object) => void }} Unmount function. It also
 *   carries an `update(nextProps)` method so a host can live-patch the feed (for example after
 *   a like changes elsewhere) without unmounting and remounting the React root.
 */
export function mountPostFeed(containerElement, props) {
  const root = createRoot(containerElement);

  function renderWithProps(nextProps) {
    root.render(
      <PostFeedView
        posts={nextProps.posts}
        title={nextProps.title}
        layoutMode={nextProps.layoutMode}
        onLike={nextProps.onLike}
        onAuthorClick={nextProps.onAuthorClick}
        currentUserId={nextProps.currentUserId}
        emptyStateMessage={nextProps.emptyStateMessage}
      />,
    );
  }

  renderWithProps(props);

  function unmount() {
    root.unmount();
  }
  unmount.update = renderWithProps;

  return unmount;
}
