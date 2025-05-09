import { Router } from "express";
import stream, { experimental_streamMKV } from "./routes/stream.js";
import getMagnet from "./routes/magnet.js";
import { search } from "./routes/search.js";
import { defaultConf, HandlerConfig, State } from "./types/config.js";
import { getFiles } from "./routes/inspectFiles.js";
import { downloadFile } from "./routes/downloadFile.js";
import { Streamer, StreamsState } from "./lib/streamer.js";
import {
  getPreStream,
  getPreStreams,
  setPreStream,
  stopPreStream,
} from "./routes/preStream.js";

/**
 * The Torrent Streamer Api Handlers
 * @param config configurations
 * @returns Express Router
 */
export function TorrentStreamerApi(config?: Partial<HandlerConfig>) {
  config = { ...defaultConf, ...config };

  const router = Router();
  const streamer = new Streamer();
  const state: State = {
    openStreams: new StreamsState(),
    cache: {
      dirPath: "/tmp/torrent-streamer-api",
    },
    streamer,
  };
  stream(router, config, state);
  getMagnet(router, config);
  search(router, config);
  getFiles(router, config);
  downloadFile(router, config, state);
  if (config.enableExperimentalMKVStream) {
    experimental_streamMKV(router, config, state);
  }
  setPreStream(router, config, state);
  getPreStream(router, config, state);
  getPreStreams(router, config, state);
  stopPreStream(router, config, state);
  return router;
}
