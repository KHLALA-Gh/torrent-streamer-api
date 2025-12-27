import { Router } from "express";
import stream, { experimental_streamMKV } from "./routes/stream.js";
import getMagnet from "./routes/magnet.js";
import { search } from "./routes/search.js";
import { defaultConf, HandlerConfig } from "./types/config.js";
import { getFiles } from "./routes/inspectFiles.js";
import { downloadFile } from "./routes/downloadFile.js";
import { Streamer, StreamsState } from "./lib/streamer.js";
import {
  getPreStream,
  getPreStreams,
  setPreStream,
  stopPreStream,
} from "./routes/preStream.js";
import { status } from "./routes/status.js";
import { Controllers } from "./index.js";
import { KeyPress } from "./lib/keypress.js";
import { State } from "./lib/state.js";
import { Logger } from "./lib/logger.js";

/**
 * The Torrent Streamer Api Handlers
 * @param config configurations
 * @returns Express Router
 */
export function TorrentStreamerApi(
  config?: Partial<HandlerConfig>,
  controllers?: Controllers
) {
  let c = { ...defaultConf, ...config };

  const router = Router();
  const streamer = new Streamer();
  const state = new State(streamer, {
    dirPath: "/tmp/torrent-streamer-api",
  });
  if (controllers) {
    controllers.destroy = (cb) => {
      streamer.destroy(cb);
      state.openStreams = new StreamsState();
    };
  }
  stream(router, c, state);
  getMagnet(router, c);
  search(router, c);
  getFiles(router, c, state);
  downloadFile(router, c, state);
  if (c.enableExperimentalMKVStream) {
    experimental_streamMKV(router, c, state);
  }
  setPreStream(router, c, state);
  getPreStream(router, c, state);
  getPreStreams(router, c, state);
  stopPreStream(router, c, state);
  status(router, c, state);
  const logger = new Logger(state, "streams");
  logger.log();
  const keyPress = new KeyPress({
    t: () => {
      logger.setMode("torrents");
    },
    s: () => {
      logger.setMode("streams");
    },
    f: () => {
      logger.setMode("files");
    },
  });
  keyPress.start();
  return router;
}
