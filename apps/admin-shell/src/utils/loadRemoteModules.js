const loadRemoteModules = Promise.all([
  import("global_layout_header/HeaderElement"),
  import("global_layout_footer/FooterElement"),
  import("login/LoginForm"),
]).then(([headerModule, footerModule, loginModule]) => {
  headerModule.registerHeaderElement();
  footerModule.registerFooterElement();

  return {
    mountLoginForm: loginModule.mountLoginForm,
  };
});

export default loadRemoteModules;
