import { Router } from "express";
import { HandlerConfig } from "../types/config.js";
import { State } from "../lib/state.js";

export function getDownloads(
  router: Router,
  config: HandlerConfig,
  state: State,
) {
  router.get("/api/downloads", async (req, res) => {
    try {
      const downloads = Array.from(state.streamer.downloads.values());
      const resp = [];
      for (let d of downloads) {
        const t = await state.streamer.get(d.infoHash);
        if (!t) continue;
        resp.push({
          name: t.name,
          infoHash: d.infoHash,
          selectedFiles: Array.from(d.selectedFiles),
          path: d.path,
          progress: t.progress,
          upSpeed: t.uploadSpeed,
          downSpeed: t.downloadSpeed,
        });
      }
      res.status(200).json(resp);
    } catch (err) {
      res.status(500).json({
        err: "server error",
      });
    }
  });
}
export function pauseDownload(
  router: Router,
  config: HandlerConfig,
  state: State,
) {
  router.put("/api/downloads", async (req, res) => {
    try {
      const hash = req.body.hash;
      if (!hash) {
        res.status(400).json({
          err: "hash is required",
        });
        return;
      }
      let files = req.body.files;
      if (!(files instanceof Array)) {
        files = undefined;
      }
      const download = state.streamer.downloads.get(hash);
      if (!download) {
        res.status(404).json({
          err: "download not found",
        });
        return;
      }
      const t = await state.streamer.get(download.infoHash);
      if (!t) {
        res.status(404).json({
          err: "torrent not found",
        });
        return;
      }
      download.pauseFiles(t, files);
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({
        err: "server error",
      });
    }
  });
}

export function deleteDownload(
  router: Router,
  config: HandlerConfig,
  state: State,
) {
  router.delete("/api/downloads/:hash", async (req, res) => {
    try {
      const hash = req.params.hash;

      const download = state.streamer.downloads.get(hash);
      if (!download) {
        res.status(404).json({
          err: "download not found",
        });
        return;
      }
      const t = await state.streamer.get(download.infoHash);
      if (!t) {
        res.status(404).json({
          err: "torrent not found",
        });
        return;
      }
      download.pauseFiles(t);
      t.destroy();
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({
        err: "server error",
      });
    }
  });
}
