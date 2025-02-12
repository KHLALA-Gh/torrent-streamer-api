import { Router } from "express";
import { HandlerConfig, State } from "../types/config";
import { Streamer } from "../lib/streamer.js";
import { decodeToUTF8 } from "../lib/encoder.js";
import { randomUUID } from "crypto";

export function stream(
  router: Router,
  config: Partial<HandlerConfig>,
  state: State
) {
  router.get("/api/stream", async (req, res) => {
    try {
      if (!req.query.magnet || typeof req.query.magnet != "string") {
        res.status(400).json({
          err: "magnet query value is required",
        });
        return;
      }
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
      const magnetURI = req.query.magnet;
      let filePath64 = req.query.path64;
      if (typeof filePath64 !== "string") {
        filePath64 = "";
      }
      if (typeof magnetURI !== "string" || !magnetURI) {
        res.status(400).json({
          error: "magnetURI is required",
        });
        return;
      }
      const range = req.headers.range;
      const streamer = new Streamer(magnetURI);
      await streamer.stream(res, decodeToUTF8(filePath64), range, (file) => {
        state.openStreams.setStream(ip, {
          id,
          infoHash: magnetURI,
          filePath: file.path,
        });
        console.clear();
        console.table(state.openStreams.ipOpenStreamsTable());
        return !res.headersSent;
      });
      res.on("close", () => {
        streamer.destroy((err) => {
          state.openStreams.removeStream(ip, id);
          console.clear();
          console.table(state.openStreams.ipOpenStreamsTable());
          if (err) {
            console.log("error while destroying streamer : " + err.toString());
            return;
          }
          console.log("response closed : streamer destroyed");
        });
      });
    } catch (err) {
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}

export default stream;
