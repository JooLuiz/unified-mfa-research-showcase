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
    port: 4203,
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
      name: "vue_mfe",
      filename: "remoteEntry.js",
      exposes: {
        "./FooterElement": "./src/footer-element.js",
        "./CheckoutSummary": "./src/checkout-summary.js",
        "./ProductCard": "./src/product-card.js",
      },
      shared: {
        vue: {
          singleton: true,
          requiredVersion: "^3.5.13",
        },
      },
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
    }),
  ],
};
