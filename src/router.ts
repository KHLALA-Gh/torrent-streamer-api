import { Router } from "express";
import stream from "./routes/stream.js";
import getMagnet from "./routes/magnet.js";
import { search } from "./routes/search.js";
import { HandlerConfig } from "./types/config.js";
import { getFiles } from "./routes/inspectFiles.js";

/**
 * The Torrent Streamer Api Handlers
 * @param config configurations
 * @returns Express Router
 */
export function TorrentStreamerApi(config: Partial<HandlerConfig>) {
  const router = Router();
  stream(router, config);
  getMagnet(router, config);
  search(router, config);
  getFiles(router, config);
  return router;
}
