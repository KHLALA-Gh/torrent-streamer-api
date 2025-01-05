import express from "express";
import streamRouter from "./routes/stream.ts";
import searchRouter from "./routes/search.ts";

const app = express();
const PORT = 8080;

app.use(streamRouter);

app.use(searchRouter);

app.listen(PORT, () => {
  console.log(`express server is listening on port ${PORT}`);
});
