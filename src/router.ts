import { Router } from "express";
import stream, { experimental_streamMKV } from "./routes/stream.js";
import getMagnet from "./routes/magnet.js";
import { search } from "./routes/search.js";
import { defaultConf, HandlerConfig } from "./types/config.js";
import { getFiles } from "./routes/inspectFiles.js";
import { downloadFile } from "./routes/downloadFile.js";
import { Streamer } from "./lib/streamer.js";

import { status } from "./routes/status.js";
import { Controllers } from "./index.js";
import { State } from "./lib/state.js";
import { verifyState } from "./routes/middleware.js";
import { downloadTorrent } from "./routes/downloadTorrent.js";
import {
  deleteDownload,
  editDownload,
  getDownloads,
  pauseDownload,
  setDownloads,
} from "./routes/downloads.js";

/**
 * The Torrent Streamer Api Handlers
 * @param config configurations
 * @returns Express Router
 */
export function TorrentStreamerApi(
  config?: Partial<HandlerConfig>,
  controllers?: Controllers,
) {
  let c = { ...defaultConf, ...config };

  const router = Router();
  const streamer = new Streamer();
  const state = new State(streamer, c, {
    dirPath: "/tmp/torrent-streamer-api",
  });
  if (controllers) {
    controllers.destroy = (cb) => {
      state.destroy(cb);
      console.log("torrent streamer api destroyed");
    };
  }
  verifyState(router, c, state);
  stream(router, c, state);
  getMagnet(router, c);
  search(router, c);
  getFiles(router, c, state);
  downloadFile(router, c, state);
  if (c.enableExperimentalMKVStream) {
    experimental_streamMKV(router, c, state);
  }
  getDownloads(router, c, state);
  deleteDownload(router, c, state);
  pauseDownload(router, c, state);
  status(router, c, state);
  downloadTorrent(router, c, state);
  setDownloads(router, c, state);
  editDownload(router, c, state);
  return router;
}
