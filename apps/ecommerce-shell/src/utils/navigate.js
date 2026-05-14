function navigate(path) {
  const currentFullPath = `${window.location.pathname}${window.location.search}`;
  if (path === currentFullPath || path === window.location.pathname) {
    return;
  }
  history.pushState({}, "", path);
  window.dispatchEvent(new CustomEvent("global:renderApp"));
}

export { navigate };
