import { publishRenderRequested } from "../events/eventBus";

function navigate(path) {
  const currentFullPath = `${window.location.pathname}${window.location.search}`;
  if (path === currentFullPath || path === window.location.pathname) {
    return;
  }
  history.pushState({}, "", path);
  publishRenderRequested();
}

export { navigate };
