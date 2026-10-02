const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = require("webpack").container;

module.exports = {
  mode: "development",
  entry: {
    main: path.resolve(__dirname, "src/index.js"),
    "iframe-bridge-client": path.resolve(
      __dirname,
      "src/iframe-bridge-client-entry.js",
    ),
  },
  output: {
    publicPath: "auto",
    filename: "[name].js",
    clean: true,
  },
  devServer: {
    port: 4308,
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
      name: "formulary",
      filename: "remoteEntry.js",
      exposes: {
        "./FormularySentElement": "./src/formulary-sent-element.js",
        "./FaqFormulary": "./src/faq-formulary.js",
        "./NewPostFormulary": "./src/new-post-formulary.js",
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
