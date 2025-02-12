import { Router } from "express";
import stream from "./routes/stream.js";
import getMagnet from "./routes/magnet.js";
import { search } from "./routes/search.js";
import { HandlerConfig, State } from "./types/config.js";
import { getFiles } from "./routes/inspectFiles.js";
import { downloadFile } from "./routes/downloadFile.js";
import { StreamsState } from "./lib/streamer.js";

/**
 * The Torrent Streamer Api Handlers
 * @param config configurations
 * @returns Express Router
 */
export function TorrentStreamerApi(config: Partial<HandlerConfig>) {
  const router = Router();
  const state: State = {
    openStreams: new StreamsState(),
  };
  stream(router, config, state);
  getMagnet(router, config);
  search(router, config);
  getFiles(router, config);
  downloadFile(router, config, state);
  return router;
}
