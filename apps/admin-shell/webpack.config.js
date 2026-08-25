const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = require("webpack").container;

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, "src/main.js"),
  output: {
    publicPath: "auto",
    clean: true,
  },
  devServer: {
    port: 4600,
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.resolve(__dirname, "public"),
    },
  },
  resolve: {
    extensions: [".js"],
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
      name: "admin_shell",
      remotes: {
        global_layout_header: "global_layout_header@http://localhost:4301/remoteEntry.js",
        global_layout_footer: "global_layout_footer@http://localhost:4302/remoteEntry.js",
        login: "login@http://localhost:4311/remoteEntry.js",
        account: "account@http://localhost:4310/remoteEntry.js",
      },
      shared: {
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
