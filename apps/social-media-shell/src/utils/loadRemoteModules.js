const loadRemoteModules = Promise.all([
  import("global_layout_header/HeaderElement"),
  import("global_layout_footer/FooterElement"),
  import("product_card/ProductCard"),
  import("product_showcase/ProductShowcaseElement"),
  import("banners/PromotionalBanner"),
  import("social_media_posts/PostFeed"),
  import("login/LoginForm"),
]).then(
  ([
    headerModule,
    footerModule,
    productCardModule,
    productShowcaseModule,
    bannersModule,
    postFeedModule,
    loginModule,
  ]) => {
    headerModule.registerHeaderElement();
    footerModule.registerFooterElement();
    productShowcaseModule.registerProductShowcaseElement();

    return {
      mountProductCard: productCardModule.mountProductCard,
      mountProductShowcase: productShowcaseModule.mountProductShowcase,
      mountPromotionalBanner: bannersModule.mountPromotionalBanner,
      mountPostFeed: postFeedModule.mountPostFeed,
      mountLoginForm: loginModule.mountLoginForm,
    };
  },
);

export default loadRemoteModules;
