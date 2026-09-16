process.env.NODE_ENV = "development";
process.env.LOCAL_AUTH = "true";

const { start } = await import("./app.js");
await start();
