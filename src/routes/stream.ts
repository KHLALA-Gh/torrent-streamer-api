import { Router } from "express";
import { HandlerConfig, State } from "../types/config";
import { decodeToUTF8 } from "../lib/encoder.js";
import { nanoid } from "nanoid";

export function stream(router: Router, config: HandlerConfig, state: State) {
  router.get("/api/stream", async (req, res) => {
    try {
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
      const fileDownload = await state.streamer.streamFile(
        hash,
        res,
        (file) => {
          if (file.name.endsWith(".mp4")) return true;
          return false;
        },
        (fileDownload) => {
          state.openStreams.removeStream(id);
          if (!state.openStreams.getIpStreamCount(ip)) {
            fileDownload.softDestroy(config.destroyTorrentTimeout, () => {
              state.streamer.downloads.delete(fileDownload.id);
            });
          }
        },
        range
      );
      if (!fileDownload) return;
      state.openStreams.setStream(id, {
        ip,
        infoHash: hash,
      });
      res.on("close", () => {
        state.openStreams.removeStream(id);
        if (!state.openStreams.getIpStreamCount(ip)) {
          fileDownload.softDestroy(config.destroyTorrentTimeout, () => {
            state.streamer.downloads.delete(fileDownload.id);
          });
        }
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

      const fileDownload = await state.streamer.experimental_streamMKV(
        magnetURI,
        res,
        decodeToUTF8(filePath64),
        (file) => {
          state.openStreams.setStream(id, {
            ip,
            infoHash: file.torrent?.infoHash || "",
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
        fileDownload?.softDestroy(config.destroyTorrentTimeout, () => {
          console.log("experimental_stream_mkv : torrent destroyed");
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
