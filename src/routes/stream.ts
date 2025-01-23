import { Router } from "express";
import { HandlerConfig } from "../types/config";
import { Streamer } from "../lib/streamer.js";

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
      if (typeof magnetURI !== "string" || !magnetURI) {
        res.status(400).json({
          error: "magnetURI is required",
        });
        return;
      }
      const range = req.headers.range;
      const streamer = new Streamer(magnetURI);
      await streamer.stream(res, range);
    } catch (err) {
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}

export default stream;
