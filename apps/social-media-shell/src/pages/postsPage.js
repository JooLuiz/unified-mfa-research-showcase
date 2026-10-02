/**
 * Renders the community posts route.
 * Role: Composes the new-post entry point, grouped post feeds, and interleaved promotional banners.
 * Not in this file: Post persistence (src/commands/postCommands.js) or trending selection (src/pages/feedPage.js).
 * Key dependencies: Banner remotes publish promotion intents; social main handles ecommerce redirect.
 * See also: src/utils/renderActions.js (public barrel); MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { publishRenderRequested } from "../events/eventBus";
import { navigate } from "../utils/navigate";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";

const POSTS_PER_BANNER_GROUP = 4;

function mountNewPostFormularyWithProps(containerElement, appState, modules) {
  const currentUser = appState.currentUser;
  return modules.mountNewPostFormulary(containerElement, {
    userName: currentUser?.fullName || currentUser?.username || "",
    userEmail: currentUser?.email || "",
    authorId: currentUser?.id || "",
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
      }),
    );
  }
}

export { renderPostsPage };
