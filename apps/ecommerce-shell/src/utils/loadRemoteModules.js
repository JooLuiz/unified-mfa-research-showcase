const loadRemoteModules = Promise.all([
  import("global_layout_header/HeaderElement"),
  import("global_layout_footer/FooterElement"),
  import("product_card/ProductCard"),
  import("product_showcase/ProductShowcaseElement"),
  import("product_list_page/ProductList"),
  import("product_details_page/ProductDetails"),
  import("banners/PromotionalBanner"),
  import("formulary/FormularySentElement"),
  import("checkout/CheckoutItems"),
  import("checkout/CheckoutSummary"),
  import("checkout/ApplyCoupon"),
  import("checkout/CheckoutEmpty"),
  import("login/LoginForm"),
  import("order_details/OrderDetails"),
]).then(
  ([
    headerModule,
    footerModule,
    productCardModule,
    productShowcaseModule,
    productListModule,
    productDetailsModule,
    bannersModule,
    formularySentModule,
    checkoutItemsModule,
    checkoutSummaryModule,
    applyCouponModule,
    checkoutEmptyModule,
    loginModule,
    orderDetailsModule,
  ]) => {
    headerModule.registerHeaderElement();
    footerModule.registerFooterElement();
    productShowcaseModule.registerProductShowcaseElement();
    formularySentModule.registerFormularySentElement();

    return {
      mountProductCard: productCardModule.mountProductCard,
      mountProductShowcase: productShowcaseModule.mountProductShowcase,
      mountProductList: productListModule.mountProductList,
      mountProductDetails: productDetailsModule.mountProductDetails,
      mountPromotionalBanner: bannersModule.mountPromotionalBanner,
      mountFormularySent: formularySentModule.mountFormularySent,
      mountCheckoutItems: checkoutItemsModule.mountCheckoutItems,
      mountCheckoutSummary: checkoutSummaryModule.mountCheckoutSummary,
      mountApplyCoupon: applyCouponModule.mountApplyCoupon,
      mountCheckoutEmpty: checkoutEmptyModule.mountCheckoutEmpty,
      mountLoginForm: loginModule.mountLoginForm,
      mountOrderDetails: orderDetailsModule.mountOrderDetails,
    };
  },
);

export default loadRemoteModules;
