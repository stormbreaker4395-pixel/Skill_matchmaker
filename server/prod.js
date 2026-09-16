process.env.NODE_ENV = "production";
process.env.LOCAL_AUTH = "false";

await import("./firebase-admin.js");
const { start } = await import("./app.js");
await start();
