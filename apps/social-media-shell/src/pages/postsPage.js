/**
 * Renders the community posts route.
 * Role: Composes the new-post entry point, grouped post feeds, and interleaved promotional banners.
 * Not in this file: Post persistence (src/commands/postCommands.js) or trending selection (src/pages/feedPage.js).
 * Key dependencies: Ecommerce shell base URL for banner redirects; src/notifications/notificationBus.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import { ECOMMERCE_SHELL_BASE_URL } from "../utils/constants";
import { notify } from "../notifications/notificationBus";
import { persistNewPost } from "../commands/postCommands";

const POSTS_PER_BANNER_GROUP = 4;

function buildBannerEcommerceUrl(banner) {
  const filters = banner?.filters || {};
  const queryParams = new URLSearchParams();
  if (filters.searchQuery) {
    queryParams.set("searchQuery", filters.searchQuery);
  }
  if (filters.minPrice) {
    queryParams.set("minPrice", filters.minPrice);
  }
  if (filters.maxPrice) {
    queryParams.set("maxPrice", filters.maxPrice);
  }
  if (Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0) {
    queryParams.set("categoryIds", filters.categoryIds.join(","));
  }
  const querySuffix = queryParams.toString();
  return querySuffix
    ? `${ECOMMERCE_SHELL_BASE_URL}/products?${querySuffix}`
    : `${ECOMMERCE_SHELL_BASE_URL}/products`;
}

function redirectToEcommerceForBanner(banner) {
  window.location.href = buildBannerEcommerceUrl(banner);
}

function mountNewPostFormularyWithProps(containerElement, appState, modules) {
  const currentUser = appState.currentUser;
  return modules.mountNewPostFormulary(containerElement, {
    userName: currentUser?.fullName || currentUser?.username || "",
    userEmail: currentUser?.email || "",
    authorId: currentUser?.id || "",
    onFormSubmitted: (payload) => {
      if (!isAuthenticated(appState)) {
        return;
      }
      void persistNewPost(appState, {
        content: payload.content,
        imageUrl: payload.imageUrl,
        authorId: appState.currentUser?.id,
      }).then((postResult) => {
        if (postResult.ok) {
          notify({
            type: "success",
            title: "Post published",
            message: "Your post is now visible in the community feed.",
          });
          window.dispatchEvent(new CustomEvent("global:renderApp"));
        }
      });
    },
  });
}

function mountLoginPromptForNewPost(containerElement) {
  containerElement.innerHTML = `
    <section class="notice-box new-post-login-prompt">
      <h3>Want to share something?</h3>
      <p>You need to be logged in to create a new post.</p>
      <button id="goToLoginButton" class="account-action-button" type="button">
        Log in to create a post
      </button>
    </section>
  `;
  const goToLoginButton = containerElement.querySelector("#goToLoginButton");
  const handleClick = () => {
    rememberPostLoginRedirect("/posts");
    navigate("/login");
  };
  if (goToLoginButton) {
    goToLoginButton.addEventListener("click", handleClick);
  }
  return () => {
    if (goToLoginButton) {
      goToLoginButton.removeEventListener("click", handleClick);
    }
    containerElement.innerHTML = "";
  };
}

/**
 * Renders the posts page with the new-post entry point and banner-interleaved post groups.
 *
 * @param {object} appState - Shell state holding session, posts, and banners.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 */
async function renderPostsPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `
    <section class="posts-page">
      <div class="posts-page-header">
        <h2>Community Posts</h2>
        <p>Share what is inspiring you and discover what others are loving.</p>
      </div>
      <div id="newPostMount" class="new-post-section"></div>
      <div id="postsListMount" class="posts-list-mount"></div>
    </section>
  `;

  const newPostMount = pageMount.querySelector("#newPostMount");
  const postsListMount = pageMount.querySelector("#postsListMount");

  if (isAuthenticated(appState)) {
    activeCleanupFunctions.push(
      mountNewPostFormularyWithProps(newPostMount, appState, modules),
    );
  } else {
    activeCleanupFunctions.push(mountLoginPromptForNewPost(newPostMount));
  }

  const allPosts = appState.posts || [];
  const banners = appState.banners || [];

  for (let groupIndex = 0; groupIndex < allPosts.length; groupIndex += POSTS_PER_BANNER_GROUP) {
    const postsGroup = allPosts.slice(groupIndex, groupIndex + POSTS_PER_BANNER_GROUP);

    const groupContainer = document.createElement("div");
    groupContainer.className = "posts-group";
    postsListMount.appendChild(groupContainer);

    activeCleanupFunctions.push(
      modules.mountPostFeed(groupContainer, {
        title: groupIndex === 0 ? "Latest Posts" : "More Posts",
        posts: postsGroup,
        onLike: (postId) => {
          console.log("renderPostsPage - postId");
          console.log(postId);
        },
        onAuthorClick: (author) => {
          if (author?.username) {
            console.log("renderPostsPage - authorClicked");
            console.log(author);
          }
        },
      }),
    );

    const hasMorePostsAfterGroup =
      groupIndex + POSTS_PER_BANNER_GROUP < allPosts.length;
    if (!hasMorePostsAfterGroup) {
      continue;
    }

    const bannerIndex = Math.floor(groupIndex / POSTS_PER_BANNER_GROUP) % banners.length;
    const banner = banners[bannerIndex];
    if (!banner) {
      continue;
    }

    const bannerContainer = document.createElement("div");
    bannerContainer.className = "posts-banner-slot";
    postsListMount.appendChild(bannerContainer);
    activeCleanupFunctions.push(
      modules.mountPromotionalBanner(bannerContainer, {
        banner,
        onApplyPromotion: () => redirectToEcommerceForBanner(banner),
      }),
    );
  }
}

export { renderPostsPage };
