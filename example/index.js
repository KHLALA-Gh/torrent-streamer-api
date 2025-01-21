import express from "express";

const app = express();
const PORT = 8080;

const router = TorrentStreamerApi({});

app.use(router);

let server = app.listen(PORT, () => {
  console.log(`express server is listening on port ${PORT}`);
});
