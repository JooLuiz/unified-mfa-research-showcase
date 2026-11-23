import loadRemoteModules from "./loadRemoteModules";
import {
  renderFeedPage,
  renderPostsPage,
  renderLoginPage,
  renderAccountPage,
} from "./renderActions";
import { MOCK_API_BASE_URL } from "./constants";
import { navigate } from "./navigate";

function createPageApp(renderPage) {
  let cleanupFunctions = [];
  let mountedDomElement = null;

  function bootstrap() {
    return Promise.resolve();
  }

  async function mount(mountProps) {
    const { appState, domElement } = mountProps;
    mountedDomElement = domElement;
    cleanupFunctions = [];

    const modules = await loadRemoteModules;
    await renderPage(appState, domElement, modules, cleanupFunctions);
  }

  function unmount() {
    cleanupFunctions.forEach((cleanupFunction) => {
      if (typeof cleanupFunction === "function") {
        try {
          cleanupFunction();
        } catch (cleanupError) {
          console.warn("createPageApp.unmount - cleanupError");
          console.warn(cleanupError);
        }
      }
    });
    cleanupFunctions = [];

    if (mountedDomElement) {
      mountedDomElement.innerHTML = "";
      mountedDomElement = null;
    }
    return Promise.resolve();
  }

  return { bootstrap, mount, unmount };
}

const feedPageApp = createPageApp(renderFeedPage);
const postsPageApp = createPageApp(renderPostsPage);
const loginPageApp = createPageApp(renderLoginPage);
const accountPageApp = createPageApp(renderAccountPage);

const notificationsPageApp = createPageApp(async (appState, domElement, modules, cleanupFunctions) => {
  if (modules.mountNotificationsPage) {
    const cleanup = modules.mountNotificationsPage(domElement, {
      navigate,
    });
    if (typeof cleanup === "function") {
      cleanupFunctions.push(cleanup);
    }
  }
});

const singlePostPageApp = createPageApp(async (appState, domElement, modules, cleanupFunctions) => {
  const pathName = window.location.pathname;
  const postId = pathName.startsWith("/posts/") ? pathName.slice("/posts/".length) : "";
  if (modules.mountSinglePost) {
    const cleanup = modules.mountSinglePost(domElement, {
      postId,
      apiBaseUrl: MOCK_API_BASE_URL,
      authToken: appState.authToken,
      currentUserId: appState.currentUser?.id,
      navigate,
      canLike: true,
    });
    if (typeof cleanup === "function") {
      cleanupFunctions.push(cleanup);
    }
  }
});

export {
  feedPageApp,
  postsPageApp,
  loginPageApp,
  accountPageApp,
  notificationsPageApp,
  singlePostPageApp,
};
