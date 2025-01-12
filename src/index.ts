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

app.listen(PORT, () => {
  console.log(`express server is listening on port ${PORT}`);
});
