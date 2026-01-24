import { Router } from "express";
import { HandlerConfig } from "../types/config.js";
import { State } from "../lib/state.js";
import { TorrentDownload } from "../types/torrent.js";
import { Download } from "../lib/streamer.js";

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
        const files = d.getFiles(t);
        let downloadSize = 0;
        let selectedFilesCount = 0;
        t.files.forEach((f) => {
          const has =
            d.files.get(f.path)?.selected || d.files.get(f.path)?.streamed;
          if (has) {
            downloadSize += f.length;
            selectedFilesCount++;
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
          idling: d.isIdling(),
          files,
          downloadSize,
          totalSize: t.length,
          downloaded: selectedFilesCount ? t.downloaded : 0,
          stopped: d.stopped,
          status: d.status,
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

export function setDownloads(
  router: Router,
  config: HandlerConfig,
  state: State,
) {
  router.post("/api/downloads", async (req, res) => {
    try {
      const downloads: TorrentDownload[] = req.body.downloads;
      if (!(downloads instanceof Array)) {
        res.status(400).json({
          err: "downlaods should be array",
        });
        return;
      }
      let setCount = 0;
      for (let d of downloads) {
        if (!(d.files instanceof Array)) {
          console.log("no files for this download " + d.infoHash);
          continue;
        }
        let selectedFiles = d.files.map((f) => {
          if (f.selected) return f.path;
          return "";
        });
        try {
          await new Promise<void>(async (res, rej) => {
            try {
              await state.streamer.downloadTorrent(
                {
                  infoHash: d.infoHash,
                  opts: { path: d.path },
                  stopped: d.stopped,
                  files: selectedFiles,
                  paused: d.paused,
                },
                (t) => {
                  console.log(`set ${t.name} path ${t.path}`);
                  setCount++;
                  res();
                },
              );
            } catch (err) {
              rej(err);
            }
          });
        } catch (err) {
          console.error("error when setting torrent :", err);
        }
      }
      res.status(200).json({
        setCount,
      });
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
      if (download.isIdling()) {
        res.status(400).json({
          err: "torrent is idling",
        });
        return;
      }
      if (download.isPaused() || download.stopped) {
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
      state.streamer.deleteDownload(hash);
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({
        err: "server error",
      });
    }
  });
}
