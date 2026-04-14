const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = require("webpack").container;

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, "src/index.js"),
  output: {
    publicPath: "auto",
    clean: true,
  },
  devServer: {
    port: 4202,
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.resolve(__dirname, "public"),
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "angular_mfe",
      filename: "remoteEntry.js",
      exposes: {
        "./ProductCard": "./src/product-card.js",
        "./ProductDetails": "./src/product-details.js",
        "./ProductShowcaseElement": "./src/product-showcase-element.js",
        "./ApplyCoupon": "./src/apply-coupon.js",
        "./FormularySentElement": "./src/formulary-sent-element.js",
      },
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
    }),
  ],
};
