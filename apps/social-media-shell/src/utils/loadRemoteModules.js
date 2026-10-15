const loadRemoteModules = Promise.all([
  import("global_layout_header/HeaderElement"),
  import("global_layout_footer/FooterElement"),
  import("product_showcase/ProductShowcaseElement"),
  import("banners/PromotionalBanner"),
  import("formulary/NewPostFormulary"),
  import("social_media_posts/PostFeed"),
  import("login/LoginForm"),
  import("notifications/Notifications"),
  import("single_post/SinglePost"),
]).then(
  ([
    headerModule,
    footerModule,
    productShowcaseModule,
    bannersModule,
    newPostFormularyModule,
    postFeedModule,
    loginModule,
    notificationsModule,
    singlePostModule,
  ]) => {
    headerModule.registerHeaderElement();
    footerModule.registerFooterElement();
    productShowcaseModule.registerProductShowcaseElement();

    return {
      mountPromotionalBanner: bannersModule.mountPromotionalBanner,
      mountNewPostFormulary: newPostFormularyModule.mountNewPostFormulary,
      mountPostFeed: postFeedModule.mountPostFeed,
      mountLoginForm: loginModule.mountLoginForm,
      mountNotificationBell: notificationsModule.mountNotificationBell,
      mountNotificationsPage: notificationsModule.mountNotificationsPage,
      mountSinglePost: singlePostModule.mountSinglePost,
    };
  },
);

export default loadRemoteModules;
