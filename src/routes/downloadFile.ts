import { Router } from "express";
import { HandlerConfig, State } from "../types/config.js";
import { Streamer, StreamerErr, StreamerErrCode } from "../lib/streamer.js";
import { createMagnetLink } from "./magnet.js";
import { trackers, wsTrackers } from "../trackers.js";
import { decodeToUTF8 } from "../lib/encoder.js";
import { randomUUID } from "crypto";

export function downloadFile(
  router: Router,
  config: Partial<HandlerConfig>,
  state: State
) {
  router.get("/api/torrents/:hash/files/:path", async (req, res) => {
    try {
      let ip = req.ip || "";
      if (ip === "::1") {
        ip = "127.0.0.1";
      }
      let limit = config?.ipStreamLimit || 10;
      if (state?.openStreams.getStreamCount(ip) >= limit) {
        res.status(403).json({
          error: "you reached your stream limit",
        });
        return;
      }
      let id = randomUUID();

      const path = decodeToUTF8(req.params.path);
      const hash = req.params.hash;
      const magnetURI = createMagnetLink(hash, trackers, wsTrackers);
      const range = req.headers.range;
      let to = setTimeout(() => {
        if (!res.headersSent) {
          res.json({ error: "Request timeout" });
        }
      }, config.torrentFilesTimeout || 10 * 1000);
      let streamer = new Streamer(magnetURI);
      streamer.streamFile(res, path, range, (file) => {
        state.openStreams.setStream(ip, {
          id,
          infoHash: hash,
          filePath: file.path,
        });
        console.clear();
        console.table(state.openStreams.ipOpenStreamsTable());
        clearTimeout(to);
        return !res.headersSent;
      });
      res.on("close", () => {
        state.openStreams.removeStream(ip, id);
        console.clear();
        console.table(state.openStreams.ipOpenStreamsTable());
        clearTimeout(to);
        streamer.destroy((err) => {
          if (err) {
            console.log("error while destroying streamer : " + err.toString());
            return;
          }
          console.log("response closed : streamer destroyed");
        });
      });
    } catch (err) {
      if (err instanceof StreamerErr) {
        if (err.code === StreamerErrCode.INVALID_PATH) {
          res.status(400).json({ error: "Invalid file path" });
          return;
        }
        res.status(500).json({ error: "unexpected streaming error" });
        return;
      }
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}
