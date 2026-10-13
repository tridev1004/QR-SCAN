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
  ],
};
