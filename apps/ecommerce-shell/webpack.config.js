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
    port: 4200,
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
      name: "ecommerce_shell",
      remotes: {
        global_layout_header: "global_layout_header@http://localhost:4301/remoteEntry.js",
        global_layout_footer: "global_layout_footer@http://localhost:4302/remoteEntry.js",
        product_card: "product_card@http://localhost:4303/remoteEntry.js",
        product_showcase: "product_showcase@http://localhost:4304/remoteEntry.js",
        product_list_page: "product_list_page@http://localhost:4305/remoteEntry.js",
        product_details_page: "product_details_page@http://localhost:4306/remoteEntry.js",
        banners: "banners@http://localhost:4307/remoteEntry.js",
        formulary: "formulary@http://localhost:4308/remoteEntry.js",
        checkout: "checkout@http://localhost:4309/remoteEntry.js",
        account: "account@http://localhost:4310/remoteEntry.js",
        login: "login@http://localhost:4311/remoteEntry.js",
        order_details: "order_details@http://localhost:4313/remoteEntry.js",
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
