import { navigate } from "./navigate";
import {
  isAuthenticated,
  setAuthSession,
  consumePostLoginRedirect,
  rememberPostLoginRedirect,
} from "./authActions";
import { ECOMMERCE_SHELL_BASE_URL, MOCK_API_BASE_URL } from "./constants";
import fetchJson from "./fetchJson";
import { notify } from "../notifications/notificationBus";

const TRENDING_LIKES_THRESHOLD = 100;
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

function getTrendingPosts(posts) {
  return posts.filter((post) => (post.likes || 0) >= TRENDING_LIKES_THRESHOLD);
}

async function renderFeedPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `
    <section class="social-home-page">
      <div id="trendingPostsMount"></div>
    </section>
  `;

  const trendingPostsMount = pageMount.querySelector("#trendingPostsMount");

  const trendingPosts = getTrendingPosts(appState.posts);

  activeCleanupFunctions.push(
    modules.mountPostFeed(trendingPostsMount, {
      title: "Trending Posts",
      layoutMode: "grid",
      posts: trendingPosts,
      onLike: (postId) => {
        console.log("renderFeedPage - postId");
        console.log(postId);
      },
      onAuthorClick: (author) => {
        if (author?.username) {
          console.log("renderFeedPage - authorClicked");
          console.log(author);
        }
      },
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

/**
 * Persists a new post and retains the current feed when the command fails.
 *
 * @param {object} appState - Shell state containing the authenticated session and posts.
 * @param {object} postPayload - Content values accepted by the post endpoint.
 * @returns {Promise<{ ok: boolean, post?: object }>} Created post result.
 * @sideEffects Adds the created post to shell state and emits a local failure notification.
 */
async function persistNewPost(appState, postPayload) {
  if (!appState.authToken) {
    notify({
      type: "error",
      title: "Post not published",
      message: "Please sign in and try again.",
    });
    return { ok: false };
  }
  try {
    const createdPost = await fetchJson(`${MOCK_API_BASE_URL}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appState.authToken}`,
      },
      body: JSON.stringify(postPayload),
    });
    appState.posts = [createdPost, ...appState.posts];
    return { ok: true, post: createdPost };
  } catch (error) {
    console.warn("persistNewPost - error");
    console.warn(error);
    notify({
      type: "error",
      title: "Post not published",
      message: "Your post was not saved. Please try again.",
    });
    return { ok: false };
  }
}

async function renderLoginPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (isAuthenticated(appState)) {
    const redirectPath = consumePostLoginRedirect() || "/";
    navigate(redirectPath);
    return;
  }

  pageMount.innerHTML = `<section id="loginMount" class="page-content"></section>`;
  const loginMount = pageMount.querySelector("#loginMount");

  activeCleanupFunctions.push(
    modules.mountLoginForm(loginMount, {
      apiBaseUrl: MOCK_API_BASE_URL,
      redirectAfterLogin: consumePostLoginRedirect(),
      onLoginSuccess: ({ token, user, redirectAfterLogin }) => {
        setAuthSession(appState, { token, user });
        notify({
          type: "success",
          title: "Signed in",
          message: `Welcome back, ${user.fullName || user.username}.`,
        });
        const targetPath = redirectAfterLogin || "/account";
        navigate(targetPath);
      },
      onCancel: () => navigate("/"),
    }),
  );
}

async function renderAccountPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (!isAuthenticated(appState)) {
    rememberPostLoginRedirect("/account");
    navigate("/login");
    return;
  }

  pageMount.innerHTML = `
    <section class="account-page">
      <div class="account-page-header">
        <h2>My Account</h2>
        <button id="backToFeedButton" class="account-action-button" type="button">Back to feed</button>
      </div>
      <div id="accountProfileMount"></div>
      <div id="accountAddressMount"></div>
      <div id="accountPostsMount" class="account-posts-section"></div>
    </section>
  `;

  const backToFeedButton = pageMount.querySelector("#backToFeedButton");
  if (backToFeedButton) {
    backToFeedButton.addEventListener("click", () => navigate("/"));
  }

  const accountProfileMount = pageMount.querySelector("#accountProfileMount");
  const accountAddressMount = pageMount.querySelector("#accountAddressMount");
  const accountPostsMount = pageMount.querySelector("#accountPostsMount");

  const [accountProfileModule, accountAddressModule] = await Promise.all([
    import("account/AccountProfile"),
    import("account/AccountAddress"),
  ]);

  activeCleanupFunctions.push(
    accountProfileModule.mountAccountProfile(accountProfileMount, {
      user: appState.currentUser,
      onSaveProfile: (profilePayload) =>
        persistAccountUpdate(appState, profilePayload),
    }),
  );

  activeCleanupFunctions.push(
    accountAddressModule.mountAccountAddress(accountAddressMount, {
      address: appState.currentUser?.address,
      onSaveAddress: (addressPayload) =>
        persistAccountUpdate(appState, { address: addressPayload }),
    }),
  );

  const currentUserId = appState.currentUser?.id;
  const currentUserPosts = (appState.posts || []).filter(
    (post) => post.authorId === currentUserId,
  );

  if (currentUserPosts.length === 0) {
    accountPostsMount.innerHTML = `
      <section class="account-card">
        <header class="account-card-header">
          <div>
            <h2 class="account-card-title">My Posts</h2>
            <p class="account-card-subtitle">You have not shared any posts yet.</p>
          </div>
        </header>
      </section>
    `;
    return;
  }

  accountPostsMount.innerHTML = `
    <section class="account-card">
      <header class="account-card-header">
        <div>
          <h2 class="account-card-title">My Posts</h2>
          <p class="account-card-subtitle">${currentUserPosts.length} post${currentUserPosts.length === 1 ? "" : "s"} shared.</p>
        </div>
      </header>
      <div id="accountPostsFeedMount"></div>
    </section>
  `;
  const accountPostsFeedMount = accountPostsMount.querySelector(
    "#accountPostsFeedMount",
  );

  activeCleanupFunctions.push(
    modules.mountPostFeed(accountPostsFeedMount, {
      title: "",
      layoutMode: "grid",
      posts: currentUserPosts,
      onLike: (postId) => {
        console.log("renderAccountPage - postId");
        console.log(postId);
      },
      onAuthorClick: (author) => {
        if (author?.username) {
          console.log("renderAccountPage - authorClicked");
          console.log(author);
        }
      },
    }),
  );
}

/**
 * Persists an account update and reports its HTTP outcome to the shell notifier.
 *
 * @param {object} appState - Shell state containing the authenticated session.
 * @param {object} updatePayload - Profile or address fields accepted by the account endpoint.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the update.
 * @sideEffects Updates the persisted session and emits a local notification.
 */
async function persistAccountUpdate(appState, updatePayload) {
  if (!appState.authToken) {
    return { ok: false };
  }
  try {
    const updatedUser = await fetchJson(`${MOCK_API_BASE_URL}/users/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appState.authToken}`,
      },
      body: JSON.stringify(updatePayload),
    });
    setAuthSession(appState, {
      token: appState.authToken,
      user: updatedUser,
    });
    const isAddressUpdate = Object.hasOwn(updatePayload, "address");
    notify({
      type: "success",
      title: isAddressUpdate ? "Address updated" : "Profile updated",
      message: "Your account changes have been saved.",
    });
    return { ok: true };
  } catch (error) {
    console.warn("persistAccountUpdate - error");
    console.warn(error);
    notify({
      type: "error",
      title: "Account update failed",
      message: "Your changes were not saved. Please try again.",
    });
    return { ok: false };
  }
}

export {
  renderFeedPage,
  renderPostsPage,
  renderLoginPage,
  renderAccountPage,
};
