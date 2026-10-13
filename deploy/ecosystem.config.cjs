const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "qrscan-api",
      cwd: path.join(__dirname, "../backend"),
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "qrscan-web",
      script: "serve",
      env: {
        NODE_ENV: "production",
        PM2_SERVE_PATH: path.join(__dirname, "../frontend/dist"),
        PM2_SERVE_PORT: 4173,
        PM2_SERVE_SPA: "true",
        PM2_SERVE_HOMEPAGE: "/index.html",
      },
    },
  ],
};
