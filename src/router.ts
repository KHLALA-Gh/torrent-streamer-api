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
  let c = { ...defaultConf, ...config };

  const router = Router();
  const streamer = new Streamer();
  const state: State = {
    openStreams: new StreamsState(),
    cache: {
      dirPath: "/tmp/torrent-streamer-api",
    },
    streamer,
  };
  stream(router, c, state);
  getMagnet(router, c);
  search(router, c);
  getFiles(router, c);
  downloadFile(router, c, state);
  if (c.enableExperimentalMKVStream) {
    experimental_streamMKV(router, c, state);
  }
  setPreStream(router, c, state);
  getPreStream(router, c, state);
  getPreStreams(router, c, state);
  stopPreStream(router, c, state);

  return router;
}
