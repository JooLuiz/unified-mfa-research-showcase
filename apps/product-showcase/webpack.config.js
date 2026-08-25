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
    port: 4304,
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
      name: "product_showcase",
      filename: "remoteEntry.js",
      remotes: {
        product_card: "product_card@http://localhost:4303/remoteEntry.js",
      },
      exposes: {
        "./ProductShowcaseElement": "./src/custom-element-adapter.ts",
      },
      shared: {
        "@angular/common": { singleton: true },
        "@angular/compiler": { singleton: true },
        "@angular/core": { singleton: true },
        "@angular/elements": { singleton: true },
        "@angular/platform-browser": { singleton: true },
        rxjs: { singleton: true },
        "zone.js": { singleton: true },
        "event-mesh/mesh": {
          singleton: true,
          requiredVersion: false,
        },
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
