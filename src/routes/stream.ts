import { Router } from "express";
import { HandlerConfig, State } from "../types/config";
import { decodeToUTF8 } from "../lib/encoder.js";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";

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
      if (state?.openStreams.getIpStreamCount(ip) >= limit) {
        res.status(403).json({
          error: "you reached your stream limit",
        });
        return;
      }
      let id = nanoid();
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
      const torrent = state.streamer.stream(
        magnetURI,
        res,
        decodeToUTF8(filePath64),
        range,
        (file) => {
          state.openStreams.setStream(id, {
            ip,
            infoHash: magnetURI,
          });
          console.clear();
          console.table(state.openStreams.ipOpenStreamsTable());
          return !res.headersSent;
        }
      );
      res.on("close", () => {
        torrent.destroy({}, (err) => {
          state.openStreams.removeStream(id);
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

export function experimental_streamMKV(
  router: Router,
  config: Partial<HandlerConfig>,
  state: State
) {
  router.get("/api/exp-stream-mkv", async (req, res) => {
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
      if (state?.openStreams.getIpStreamCount(ip) >= limit) {
        res.status(403).json({
          error: "you reached your stream limit",
        });
        return;
      }
      let id = nanoid();
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

      const torrent = await state.streamer.experimental_streamMKV(
        magnetURI,
        res,
        decodeToUTF8(filePath64),
        (file) => {
          state.openStreams.setStream(id, {
            ip,
            infoHash: magnetURI,
          });
          console.clear();
          console.table(state.openStreams.ipOpenStreamsTable());
          return !res.headersSent;
        }
      );
      req.on("close", () => {
        state.openStreams.removeStream(id);
        console.clear();
        console.table(state.openStreams.ipOpenStreamsTable());
        torrent.destroy({}, (err) => {
          if (err) {
            console.log("error when destroying the streamer : ", err);
            return;
          }
          console.log("request closed streamer destroyed");
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
