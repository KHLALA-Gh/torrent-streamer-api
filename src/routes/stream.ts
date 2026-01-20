import { Router } from "express";
import { HandlerConfig } from "../types/config";
import { decodeToUTF8 } from "../lib/encoder.js";
import { nanoid } from "nanoid";
import { getClientIp } from "request-ip";
import { State } from "../lib/state";

export function stream(router: Router, config: HandlerConfig, state: State) {
  router.get("/api/stream", async (req, res) => {
    try {
      let ip = req.ip || "";
      if (ip === "::1") {
        ip = "127.0.0.1";
      }
      let limit = config?.ipStreamLimit || 10;
      if ((state?.openStreams?.getIpStreamCount(ip) || 0) >= limit) {
        res.status(403).json({
          error: "you reached your stream limit",
        });
        return;
      }
      let id = nanoid();
      const hash = req.query.hash;
      let filePath64 = req.query.path64;
      if (typeof filePath64 !== "string") {
        filePath64 = "";
      }
      if (typeof hash !== "string" || !hash) {
        res.status(400).json({
          error: "hash is required",
        });
        return;
      }
      const range = req.headers.range;

      const { torrent, download } = await state.streamer.streamFile(
        hash,
        res,
        (file) => {
          if (file.name.endsWith(".mp4") || file.name.endsWith(".mkv"))
            return true;
          return false;
        },
        (download) => {
          state.removeStream(id);
        },
        range,
      );
      if (!torrent) return;
      state.setStream(id, {
        ip,
        infoHash: hash,
      });
      res.on("close", () => {
        state.removeStream(id);
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
  config: HandlerConfig,
  state: State,
) {
  router.get("/api/exp-stream-mkv", async (req, res) => {
    try {
      if (!req.query.magnet || typeof req.query.magnet != "string") {
        res.status(400).json({
          err: "magnet query value is required",
        });
        return;
      }
      let ip = getClientIp(req) || "";
      let limit = config?.ipStreamLimit || 10;
      if ((state?.openStreams?.getIpStreamCount(ip) || 0) >= limit) {
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

      const resp = await state.streamer?.experimental_streamMKV(
        magnetURI,
        res,
        decodeToUTF8(filePath64),
        (file) => {
          state.setStream(id, {
            ip,
            infoHash: magnetURI,
            filePath: file.path,
          });
          console.clear();
          console.table(state.openStreams?.ipOpenStreamsTable());
          return !res.headersSent;
        },
      );
      req.on("close", () => {
        state.removeStream(id);
        console.clear();
        console.table(state.openStreams?.ipOpenStreamsTable());
      });
    } catch (err) {
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}

export default stream;
