import express from "express";
import TorrentStreamerApi from "torrent-streamer-api";

const app = express();
const PORT = 8080;

const router = TorrentStreamerApi({});

app.use(router);

let server = app.listen(PORT, () => {
  console.log(`express server is listening on port ${PORT}`);
});
