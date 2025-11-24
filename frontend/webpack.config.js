const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: "./bundle.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "/"),
  },
  resolve: {
    fallback: {
      buffer: require.resolve("buffer/"), // Polyfill buffer
      process: require.resolve("process/browser"), // Polyfill process
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"], // Provide Buffer globally
      process: "process/browser", // Provide process globally
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, "/"),
    },
    port: 3000,
  },
  mode: "development",
};
