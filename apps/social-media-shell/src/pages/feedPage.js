/**
 * Renders the social feed route.
 * Role: Composes the trending posts feed with the featured-products showcase web component,
 *   kept live by recomputing the trending list whenever a like is toggled anywhere.
 * Not in this file: Post creation (src/pages/postsPage.js), post persistence
 *   (src/commands/postCommands.js), or the toggle write itself (src/commands/postLikeCommands.js).
 * Key dependencies: angular-product-showcase custom element; catalog intents handled by social
 *   mesh listeners; src/events/communityLikesLiveEvents.js.
 * See also: src/utils/renderActions.js (public barrel); MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import {
  subscribeToCommunityLikesChanged,
  applyLikesChangeToPosts,
} from "../events/communityLikesLiveEvents";

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

  const trendingPostFeedHandle = modules.mountPostFeed(trendingPostsMount, {
    title: "Trending Posts",
    layoutMode: "grid",
    posts: getTrendingPosts(appState.posts),
    currentUserId: appState.currentUser?.id,
    emptyStateMessage: EMPTY_TRENDING_MESSAGE,
  });
  activeCleanupFunctions.push(trendingPostFeedHandle);

  activeCleanupFunctions.push(
    subscribeToCommunityLikesChanged((likesChangedPayload) => {
      appState.posts = applyLikesChangeToPosts(
        appState.posts,
        appState.currentUser?.id,
        likesChangedPayload,
      );
      trendingPostFeedHandle.update({
        title: "Trending Posts",
        layoutMode: "grid",
        posts: getTrendingPosts(appState.posts),
        currentUserId: appState.currentUser?.id,
        emptyStateMessage: EMPTY_TRENDING_MESSAGE,
      });
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
