import express from "express";
import streamRouter from "./routes/stream.js";
import searchRouter from "./routes/search.js";
import getMagnetURI from "./routes/magnet.js";
import cors from "cors";
const app = express();
const PORT = 8080;

app.use(cors());

app.use(streamRouter);

app.use(searchRouter);

app.use(getMagnetURI);
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Cleaning up...");
  setTimeout(() => {
    process.exit(0);
  }, 2000);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

let server = app.listen(PORT, () => {
  console.log(`express server is listening on port ${PORT}`);
});
