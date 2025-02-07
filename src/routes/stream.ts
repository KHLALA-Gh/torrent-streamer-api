import { Router } from "express";
import { HandlerConfig } from "../types/config";
import { Streamer } from "../lib/streamer.js";
import { decodeToUTF8 } from "../lib/encoder.js";

export function stream(router: Router, _: Partial<HandlerConfig>) {
  router.get("/api/stream", async (req, res) => {
    try {
      if (!req.query.magnet || typeof req.query.magnet != "string") {
        res.status(400).json({
          err: "magnet query value is required",
        });
        return;
      }
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
      await streamer.stream(res, decodeToUTF8(filePath64), range);
    } catch (err) {
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}

export default stream;
