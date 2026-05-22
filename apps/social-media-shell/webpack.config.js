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
    port: 4500,
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
      name: "social_media_shell",
      remotes: {
        global_layout_header: "global_layout_header@http://localhost:4301/remoteEntry.js",
        global_layout_footer: "global_layout_footer@http://localhost:4302/remoteEntry.js",
        product_card: "product_card@http://localhost:4303/remoteEntry.js",
        product_showcase: "product_showcase@http://localhost:4304/remoteEntry.js",
        banners: "banners@http://localhost:4307/remoteEntry.js",
        formulary: "formulary@http://localhost:4308/remoteEntry.js",
        account: "account@http://localhost:4310/remoteEntry.js",
        login: "login@http://localhost:4311/remoteEntry.js",
        social_media_posts: "social_media_posts@http://localhost:4312/remoteEntry.js",
      },
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
    }),
  ],
};
