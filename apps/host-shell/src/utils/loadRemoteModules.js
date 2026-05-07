const loadRemoteModules = Promise.all([
  import("react_mfe/HeaderElement"),
  import("react_mfe/PromotionalBanner"),
  import("react_mfe/ProductList"),
  import("react_mfe/CheckoutItems"),
  import("vue_mfe/ProductCard"),
  import("angular_mfe/ProductDetails"),
  import("angular_mfe/ProductShowcaseElement"),
  import("angular_mfe/ApplyCoupon"),
  import("angular_mfe/FormularySentElement"),
  import("vue_mfe/FooterElement"),
  import("vue_mfe/CheckoutSummary"),
]).then(
  ([
    headerModule,
    bannerModule,
    productListModule,
    checkoutItemsModule,
    productCardModule,
    productDetailsModule,
    productShowcaseModule,
    applyCouponModule,
    formularySentModule,
    footerModule,
    checkoutSummaryModule,
  ]) => {
    headerModule.registerHeaderElement();
    productShowcaseModule.registerProductShowcaseElement();
    formularySentModule.registerFormularySentElement();
    footerModule.registerFooterElement();

    return {
      mountPromotionalBanner: bannerModule.mountPromotionalBanner,
      mountProductList: productListModule.mountProductList,
      mountCheckoutItems: checkoutItemsModule.mountCheckoutItems,
      mountProductCard: productCardModule.mountProductCard,
      mountProductDetails: productDetailsModule.mountProductDetails,
      mountProductShowcase: productShowcaseModule.mountProductShowcase,
      mountApplyCoupon: applyCouponModule.mountApplyCoupon,
      mountFormularySent: formularySentModule.mountFormularySent,
      mountCheckoutSummary: checkoutSummaryModule.mountCheckoutSummary,
    };
  },
);

export default loadRemoteModules;
