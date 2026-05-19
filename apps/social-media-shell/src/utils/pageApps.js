import loadRemoteModules from "./loadRemoteModules";
import {
  renderFeedPage,
  renderPostsPage,
  renderLoginPage,
  renderAccountPage,
} from "./renderActions";

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

export { feedPageApp, postsPageApp, loginPageApp, accountPageApp };
