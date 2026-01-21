import { Router } from "express";
import { State } from "../lib/state";
import { HandlerConfig } from "../types/config";
import { TorrentDownload } from "../types/torrent";

export function downloadTorrent(
  router: Router,
  config: HandlerConfig,
  state: State,
) {
  router.post("/api/torrents/:hash/download", async (req, res) => {
    try {
      const hash = req.params.hash;
      const path = req.body.path;
      if (typeof hash !== "string") {
        res.status(400).json({
          err: "hash is required",
        });
        return;
      }
      if (typeof path !== "string") {
        res.status(400).json({
          err: "path is required",
        });
        return;
      }
      const files: string[] = req.body.files;
      if (files && !(files instanceof Array)) {
        res.status(400).json({
          err: "files must be array of strings",
        });
        return;
      }

      let d = state.streamer.getDownload(hash);

      await state.streamer?.downloadTorrent(
        { infoHash: hash, files, opts: { path } },
        (t) => {
          const selectedFiles = new Set(files);
          const resp: TorrentDownload = {
            name: t.name,
            path: t.path,
            files: t.files.map((f) => {
              return {
                path: f.path,
                selected: selectedFiles.has(f.path),
                paused: d?.files.get(f.path)?.paused || false,
                streamed: d?.files.get(f.path)?.streamed || false,
                progress: f.progress,
              };
            }),
            progress: t.progress,
            downSpeed: t.downloadSpeed,
            upSpeed: t.uploadSpeed,
            infoHash: t.infoHash,
            paused: false,
            downloadSize: t.files.reduce((prev, file2) => {
              if (selectedFiles.has(file2.path)) return prev + file2.length;
              return 0;
            }, 0),
            totalSize: t.length,
            downloaded: t.downloaded,
            stopped: false,
          };
          res.status(200).json(resp);
        },
      );
    } catch (err) {
      res.status(500).json({
        err: "server error",
      });
    }
  });
}
