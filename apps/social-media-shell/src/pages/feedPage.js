/**
 * Renders the social feed route.
 * Role: Composes the trending posts feed with the featured-products showcase web component,
 *   kept live by recomputing the trending list whenever a like is toggled anywhere, or
 *   whenever anyone publishes a new post.
 * Not in this file: Post creation (src/pages/postsPage.js), post persistence
 *   (src/commands/postCommands.js), or the toggle write itself (src/commands/postLikeCommands.js).
 * Key dependencies: angular-product-showcase custom element; @shared/community-events
 *   publishPostLikesWatching; @shared/post-like-events.
 * See also: src/utils/renderActions.js (public barrel); MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import mesh from "event-mesh/mesh";
import { createCommunityEvents } from "@shared/community-events";
import {
  subscribeToPostLikesChanged,
  applyLikesChangeToPosts,
  subscribeToPostCreated,
} from "@shared/post-like-events";
import { navigate } from "../utils/navigate";

const { publishPostLikesWatching } = createCommunityEvents(mesh);

const TRENDING_LIKES_THRESHOLD = 1;
const EMPTY_TRENDING_MESSAGE = "No trending posts yet.";

function getTrendingPosts(posts) {
  return posts.filter((post) => (post.likes || 0) >= TRENDING_LIKES_THRESHOLD);
}

/**
 * Renders the feed page with trending posts and an optional product showcase.
 *
 * @param {object} appState - Shell state holding posts, showcases, and productsById.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 */
async function renderFeedPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `
    <section class="social-home-page">
      <div id="trendingPostsMount"></div>
    </section>
  `;

  const trendingPostsMount = pageMount.querySelector("#trendingPostsMount");

  const handlePostClick = (post) => {
    if (post?.id) {
      navigate(`/posts/${encodeURIComponent(post.id)}`);
    }
  };

  const trendingPostFeedHandle = modules.mountPostFeed(trendingPostsMount, {
    title: "Trending Posts",
    layoutMode: "grid",
    posts: getTrendingPosts(appState.posts),
    currentUserId: appState.currentUser?.id,
    emptyStateMessage: EMPTY_TRENDING_MESSAGE,
    onPostClick: handlePostClick,
  });
  activeCleanupFunctions.push(trendingPostFeedHandle);

  // Re-renders the mounted trending feed from the latest appState.posts. Shared by the
  // likes-changed and post-created subscriptions below so both live pushes stay in sync.
  const renderTrendingFeed = () =>
    trendingPostFeedHandle.update({
      title: "Trending Posts",
      layoutMode: "grid",
      posts: getTrendingPosts(appState.posts),
      currentUserId: appState.currentUser?.id,
      emptyStateMessage: EMPTY_TRENDING_MESSAGE,
      onPostClick: handlePostClick,
    });

  activeCleanupFunctions.push(
    subscribeToPostLikesChanged((likesChangedPayload) => {
      appState.posts = applyLikesChangeToPosts(
        appState.posts,
        appState.currentUser?.id,
        likesChangedPayload,
      );
      renderTrendingFeed();
    }),
  );

  // appState.posts was already prepended by the global subscription in main.js; this one only
  // re-renders. A new post starts below the trending threshold, so this tab must watch it
  // before the like arrives or the gateway will not deliver the count that promotes it.
  activeCleanupFunctions.push(
    subscribeToPostCreated((newPost) => {
      publishPostLikesWatching(newPost?.id);
      renderTrendingFeed();
    }),
  );

  const firstShowcase = appState.showcases[0];
  const showcaseProducts = (firstShowcase?.productIds || [])
    .map((productId) => appState.productsById[productId])
    .filter(Boolean);

  if (showcaseProducts.length > 0) {
    const showcaseElement = document.createElement("angular-product-showcase");
    showcaseElement.config = {
      title: firstShowcase?.showcaseTitle || "Featured Products",
      products: showcaseProducts,
      actionLabel: "See More",
      actionIntent: "open-product",
      hideQuantity: true,
      displayMode: "modal",
      defaultCollapsed: false,
    };
    pageMount.appendChild(showcaseElement);

    activeCleanupFunctions.push(() => {
      if (showcaseElement.parentNode) {
        showcaseElement.parentNode.removeChild(showcaseElement);
      }
    });
  }
}

export { renderFeedPage };
