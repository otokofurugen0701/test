module.exports = {
  apps: [
    {
      name: "smagomi-dev",
      script: "node_modules/next/dist/bin/next",
      args: "dev -H 0.0.0.0 -p 3000",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "smagomi-prod",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
