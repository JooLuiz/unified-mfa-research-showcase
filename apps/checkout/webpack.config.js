const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = require("webpack").container;
const { AngularWebpackPlugin } = require("@ngtools/webpack");

module.exports = {
  mode: "development",
  entry: {
    main: path.resolve(__dirname, "src/index.ts"),
    "checkout-empty": path.resolve(__dirname, "src/checkout-empty-entry.ts"),
  },
  output: {
    publicPath: "auto",
    filename: "[name].bundle.js",
    clean: true,
  },
  devServer: {
    port: 4309,
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.resolve(__dirname, "public"),
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: ["@ngtools/webpack"],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "checkout",
      filename: "remoteEntry.js",
      exposes: {
        "./CheckoutItems": "./src/checkout-items.ts",
        "./CheckoutSummary": "./src/checkout-summary.ts",
        "./ApplyCoupon": "./src/apply-coupon.ts",
        "./CheckoutEmpty": "./src/checkout-empty.ts",
      },
      shared: {
        "@angular/common": { singleton: true },
        "@angular/compiler": { singleton: true },
        "@angular/core": { singleton: true },
        "@angular/elements": { singleton: true },
        "@angular/platform-browser": { singleton: true },
        rxjs: { singleton: true },
        "zone.js": { singleton: true },
      },
    }),
    new AngularWebpackPlugin({
      tsconfig: path.resolve(__dirname, "tsconfig.json"),
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
      filename: "index.html",
      chunks: ["main"],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/checkout-empty.html"),
      filename: "checkout-empty.html",
      chunks: ["checkout-empty"],
    }),
  ],
};
