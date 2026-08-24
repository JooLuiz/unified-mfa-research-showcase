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
    port: 4313,
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
      name: "order_details",
      filename: "remoteEntry.js",
      exposes: {
        "./OrderDetails": "./src/order-details.js",
      },
      shared: {
        vue: {
          singleton: true,
          requiredVersion: "^3.5.13",
        },
        "event-mesh/mesh": {
          singleton: true,
          requiredVersion: false,
        },
      },
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
    }),
  ],
};
