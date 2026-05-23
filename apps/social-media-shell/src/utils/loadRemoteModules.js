const loadRemoteModules = Promise.all([
  import("global_layout_header/HeaderElement"),
  import("global_layout_footer/FooterElement"),
  import("product_showcase/ProductShowcaseElement"),
  import("banners/PromotionalBanner"),
  import("formulary/NewPostFormulary"),
  import("social_media_posts/PostFeed"),
  import("login/LoginForm"),
]).then(
  ([
    headerModule,
    footerModule,
    productShowcaseModule,
    bannersModule,
    newPostFormularyModule,
    postFeedModule,
    loginModule,
  ]) => {
    headerModule.registerHeaderElement();
    footerModule.registerFooterElement();
    productShowcaseModule.registerProductShowcaseElement();

    return {
      mountPromotionalBanner: bannersModule.mountPromotionalBanner,
      mountNewPostFormulary: newPostFormularyModule.mountNewPostFormulary,
      mountPostFeed: postFeedModule.mountPostFeed,
      mountLoginForm: loginModule.mountLoginForm,
    };
  },
);

export default loadRemoteModules;
