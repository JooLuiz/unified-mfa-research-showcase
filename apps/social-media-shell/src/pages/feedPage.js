/**
 * Renders the social feed route.
 * Role: Composes the trending posts feed with the featured-products showcase web component,
 *   kept live by patching likes/likedByCurrentUser and recomputing the trending list whenever
 *   a like is toggled anywhere.
 * Not in this file: Post creation (src/pages/postsPage.js), post persistence
 *   (src/commands/postCommands.js), or the toggle write itself (src/commands/postLikeCommands.js).
 * Key dependencies: angular-product-showcase custom element; ecommerce shell base URL for
 *   product redirects; @shared/post-like-events; src/commands/postLikeCommands.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { subscribeToPostLikesChanged } from "@shared/post-like-events";
import { ECOMMERCE_SHELL_BASE_URL, MOCK_API_BASE_URL } from "../utils/constants";
import { toggleLikeForPost } from "../commands/postLikeCommands";

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

  const handleLike = (postId) =>
    toggleLikeForPost(appState, appState.posts.find((post) => post.id === postId));

  const handleAuthorClick = (author) => {
    if (author?.username) {
      console.log("renderFeedPage - authorClicked");
      console.log(author);
    }
  };

  const trendingPostFeedHandle = modules.mountPostFeed(trendingPostsMount, {
    title: "Trending Posts",
    layoutMode: "grid",
    posts: getTrendingPosts(appState.posts),
    currentUserId: appState.currentUser?.id,
    emptyStateMessage: EMPTY_TRENDING_MESSAGE,
    onLike: handleLike,
    onAuthorClick: handleAuthorClick,
  });
  activeCleanupFunctions.push(trendingPostFeedHandle);

  activeCleanupFunctions.push(
    subscribeToPostLikesChanged(MOCK_API_BASE_URL, ({ postId, likes }) => {
      appState.posts = appState.posts.map((post) =>
        post.id === postId ? { ...post, likes } : post,
      );
      trendingPostFeedHandle.update({
        title: "Trending Posts",
        layoutMode: "grid",
        posts: getTrendingPosts(appState.posts),
        currentUserId: appState.currentUser?.id,
        emptyStateMessage: EMPTY_TRENDING_MESSAGE,
        onLike: handleLike,
        onAuthorClick: handleAuthorClick,
      });
    }),
  );

  const firstShowcase = appState.showcases[0];
  const showcaseProducts = (firstShowcase?.productIds || [])
    .map((productId) => appState.productsById[productId])
    .filter(Boolean);

  if (showcaseProducts.length > 0) {
    const redirectToProductDetails = (productId) =>
      window.location.assign(
        `${ECOMMERCE_SHELL_BASE_URL}/product?productId=${productId}`,
      );

    const showcaseElement = document.createElement("angular-product-showcase");
    showcaseElement.config = {
      title: firstShowcase?.showcaseTitle || "Featured Products",
      products: showcaseProducts,
      actionLabel: "See More",
      hideQuantity: true,
      displayMode: "modal",
      defaultCollapsed: false,
      onProductClick: redirectToProductDetails,
      onAddToCart: (showcasePayload) => {
        redirectToProductDetails(showcasePayload.productId);
      },
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
