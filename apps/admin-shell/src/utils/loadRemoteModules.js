const loadRemoteModules = Promise.all([
  import("global_layout_header/HeaderElement"),
  import("global_layout_footer/FooterElement"),
  import("login/LoginForm"),
  import("order_details/OrderDetails"),
  import("notifications/Notifications"),
  import("single_post/SinglePost"),
]).then(
  ([
    headerModule,
    footerModule,
    loginModule,
    orderDetailsModule,
    notificationsModule,
    singlePostModule,
  ]) => {
    headerModule.registerHeaderElement();
    footerModule.registerFooterElement();

    return {
      mountLoginForm: loginModule.mountLoginForm,
      mountOrderDetails: orderDetailsModule.mountOrderDetails,
      mountNotificationBell: notificationsModule.mountNotificationBell,
      mountNotificationsPage: notificationsModule.mountNotificationsPage,
      mountSinglePost: singlePostModule.mountSinglePost,
    };
  },
);

export default loadRemoteModules;
