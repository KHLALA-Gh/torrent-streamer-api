import express from "express";
import streamRouter from "./routes/stream.ts";
import searchRouter from "./routes/search.ts";
import getMagnetURI from "./routes/magnet.ts";
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
