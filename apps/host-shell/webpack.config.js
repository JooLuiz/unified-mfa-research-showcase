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
      name: "host_shell",
      remotes: {
        react_mfe: "react_mfe@http://localhost:4201/remoteEntry.js",
        angular_mfe: "angular_mfe@http://localhost:4202/remoteEntry.js",
        vue_mfe: "vue_mfe@http://localhost:4203/remoteEntry.js",
      },
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
    }),
  ],
};
