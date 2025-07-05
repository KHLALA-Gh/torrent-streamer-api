import { Router } from "express";
import { HandlerConfig, State } from "../types/config";
import { TorrentFileMetaData } from "../types/torrent";
import { encodeTo64 } from "../lib/encoder.js";
import { Torrent } from "webtorrent";

function getTorrnetFiles(torrent: Torrent): TorrentFileMetaData[] {
  let files: TorrentFileMetaData[] = [];
  torrent.files.map((t) => {
    files.push({
      name: t.name,
      path: t.path,
      size: t.length,
      path64: encodeTo64(t.path),
    });
  });
  return files;
}

export function getFiles(
  router: Router,
  config: Partial<HandlerConfig>,
  state: State
) {
  router.get("/api/torrents/:hash/files", async (req, res) => {
    try {
      let hash = req.params.hash;
      let to = setTimeout(() => {
        if (res.headersSent) return;
        res.json([]);
      }, config.torrentFilesTimeout || 10 * 1000);
      req.on("close", () => {
        clearTimeout(to);
      });
      let stop = state.openStreams.logFetchingTorrentData(hash);

      let torrent = await state.streamer.getTorrent(hash);
      stop(
        `Done!\nInfo Hash : ${hash}\nName : ${torrent.name}\nFiles : ${torrent.files.length}`
      );
      clearTimeout(to);
      let files = getTorrnetFiles(torrent);
      if (res.headersSent) return;
      res.status(200).json(files);
    } catch (err) {
      console.log("error when requesting torrent files :", err);
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}
