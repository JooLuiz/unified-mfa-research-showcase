/**
 * Renders the account route with profile, address, and own-posts sections.
 * Role: Composes the account MFE mounts and the current user's post feed.
 * Not in this file: Account HTTP updates (src/commands/accountCommands.js) or post creation (src/pages/postsPage.js).
 * Key dependencies: account/AccountProfile and account/AccountAddress remotes.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import { persistAccountUpdate } from "../commands/accountCommands";
import { requestCsvExport } from "../exports/requestCsvExport";
import { notify } from "../notifications/notificationBus";

/**
 * Renders the account page with profile, address, and "My Posts" sections.
 *
 * @param {object} appState - Shell state holding the authenticated session and posts.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 */
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

  accountPostsMount.innerHTML = `
    <section class="account-card">
      <header class="account-card-header">
        <div>
          <h2 class="account-card-title">My Posts</h2>
          <p class="account-card-subtitle">${
            currentUserPosts.length === 0
              ? "You have not shared any posts yet."
              : `${currentUserPosts.length} post${currentUserPosts.length === 1 ? "" : "s"} shared.`
          }</p>
        </div>
        <button id="exportPostsButton" class="account-action-button" type="button">
          Export CSV
        </button>
      </header>
      ${currentUserPosts.length > 0 ? '<div id="accountPostsFeedMount"></div>' : ""}
    </section>
  `;
  const exportPostsButton = accountPostsMount.querySelector("#exportPostsButton");
  const handlePostsExport = async () => {
    const exportResult = await requestCsvExport({
      endpointPath: "/exports/posts.csv",
      fileName: "my-posts.csv",
      authToken: appState.authToken,
    });
    notify(
      exportResult.ok
        ? {
            type: "success",
            title: "Posts exported",
            message: "Your posts have been downloaded as a CSV file.",
          }
        : {
            type: "error",
            title: "Post export failed",
            message: "Your posts could not be exported. Please try again.",
          },
    );
  };
  if (exportPostsButton) {
    exportPostsButton.addEventListener("click", handlePostsExport);
    activeCleanupFunctions.push(() => {
      exportPostsButton.removeEventListener("click", handlePostsExport);
    });
  }

  if (currentUserPosts.length === 0) {
    return;
  }

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

export { renderAccountPage };
