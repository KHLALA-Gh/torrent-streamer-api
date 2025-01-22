import { Router } from "express";
import { HandlerConfig } from "../types/config";
import { Streamer } from "../lib/streamer.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stream(router: Router, config: Partial<HandlerConfig>) {
  router.get("/api/stream", async (req, res) => {
    try {
      if (!req.query.magnet || typeof req.query.magnet != "string") {
        res.status(400).json({
          err: "magnet query value is required",
        });
        return;
      }
      const magnetURI = req.query.magnet;
      const range = req.headers.range;
      const streamer = new Streamer(magnetURI);
      streamer.stream(res, range);
      req.on("close", () => {
        streamer.destroy((err) => {
          if (err) {
            console.log("error while destroying streamer : " + err.toString());
            return;
          }
          console.log("request closed : streamer destroyed");
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
