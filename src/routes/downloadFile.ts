import { Router } from "express";
import { HandlerConfig } from "../types/config.js";
import { Streamer, StreamerErr, StreamerErrCode } from "../lib/streamer.js";
import { createMagnetLink } from "./magnet.js";
import { trackers, wsTrackers } from "../trackers.js";
import { decodeToUTF8 } from "../lib/encoder.js";

export function downloadFile(router: Router, config: Partial<HandlerConfig>) {
  router.get("/api/torrents/:hash/files/:path", (req, res) => {
    try {
      const path = decodeToUTF8(req.params.path);
      const hash = req.params.hash;
      const magnetURI = createMagnetLink(hash, trackers, wsTrackers);
      const range = req.headers.range;
      let to = setTimeout(() => {
        res.json({
          error: "Request timeout",
        });
      }, config.torrentFilesTimeout || 10 * 1000);
      let streamer = new Streamer(magnetURI);
      streamer.streamFile(res, path, range);
      res.on("close", () => {
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
