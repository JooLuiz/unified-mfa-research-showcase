const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = require("webpack").container;
const { AngularWebpackPlugin } = require("@ngtools/webpack");

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, "src/index.ts"),
  output: {
    publicPath: "auto",
    clean: true,
  },
  devServer: {
    port: 4306,
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
      name: "product_details_page",
      filename: "remoteEntry.js",
      exposes: {
        "./ProductDetails": "./src/product-details.ts",
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
    }),
  ],
};
