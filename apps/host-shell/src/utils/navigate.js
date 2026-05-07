function navigate(path) {
  history.pushState({}, "", path);
  window.dispatchEvent(new CustomEvent("global:renderApp"));
}

export { navigate };
