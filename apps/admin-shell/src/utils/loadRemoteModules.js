const loadRemoteModules = Promise.all([
  import("global_layout_header/HeaderElement"),
  import("global_layout_footer/FooterElement"),
  import("login/LoginForm"),
  import("order_details/OrderDetails"),
]).then(([headerModule, footerModule, loginModule, orderDetailsModule]) => {
  headerModule.registerHeaderElement();
  footerModule.registerFooterElement();

  return {
    mountLoginForm: loginModule.mountLoginForm,
    mountOrderDetails: orderDetailsModule.mountOrderDetails,
  };
});

export default loadRemoteModules;
