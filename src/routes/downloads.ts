import { Router } from "express";
import { HandlerConfig } from "../types/config.js";
import { State } from "../lib/state.js";
import { TorrentDownload } from "../types/torrent.js";

export function getDownloads(
  router: Router,
  config: HandlerConfig,
  state: State,
) {
  router.get("/api/downloads", async (req, res) => {
    try {
      const downloads = Array.from(state.streamer.downloads.values());
      const resp: TorrentDownload[] = [];
      for (let d of downloads) {
        const t = await state.streamer.get(d.infoHash);
        if (!t) continue;
        let downloadSize = 0;
        t.files.forEach((f) => {
          const has =
            d.files.get(f.path)?.selected || d.files.get(f.path)?.streamed;
          if (has) {
            downloadSize += f.length;
          }
        });
        resp.push({
          name: t.name,
          infoHash: d.infoHash,
          path: d.path,
          progress: t.progress,
          upSpeed: t.uploadSpeed,
          downSpeed: t.downloadSpeed,
          paused: d.isPaused(),
          files: d.getFiles(t),
          downloadSize,
          totalSize: t.length,
          downloaded: t.downloaded,
          stopped: d.stopped,
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
      const hash: string = req.body.hash;
      if (!hash || typeof hash !== "string") {
        res.status(400).json({
          err: "hash is required",
        });
        return;
      }
      const download = state.streamer.getDownload(hash);
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
      const stop = req.body.stop;
      if (stop === true) {
        download.stop(t);
        state.openStreams?.removeStreamsWithHash(hash);

        res.sendStatus(200);
        return;
      }
      if (download.isPaused()) {
        download.resume(t);
      } else {
        download.pauseFiles(t);
      }
      res.sendStatus(200);
    } catch (err) {
      console.log(err);

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
      const download = state.streamer.getDownload(hash);
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
      state.streamer.downloads.delete(hash);
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({
        err: "server error",
      });
    }
  });
}
