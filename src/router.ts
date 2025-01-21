import { Router } from "express";
import stream from "./routes/stream.js";
import getMagnet from "./routes/magnet.js";
import { search } from "./routes/search.js";

export function TorrentStreamerApi(config: Partial<HandlerConfig>) {
  const router = Router();
  stream(router, config);
  getMagnet(router, config);
  search(router, config);
  return router;
}
