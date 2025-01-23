import express from "express";
import { TorrentStreamerApi } from "../dist/router.js";
import cors from "cors";
const app = express();
app.use(cors());

app.use(TorrentStreamerApi({}));
app.listen(8080);
