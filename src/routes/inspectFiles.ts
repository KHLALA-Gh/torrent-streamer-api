import { Router } from "express";
import { HandlerConfig } from "../types/config";
import { TorrentFileMetaData } from "../types/torrent";
import { encodeTo64 } from "../lib/encoder.js";
import { Torrent } from "webtorrent";
import { State } from "../lib/state";

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
  state: State,
) {
  router.get("/api/torrents/:hash/files", async (req, res) => {
    let stop: ((text: string) => void) | undefined;
    try {
      let hash = req.params.hash;
      let path = req.query.path;
      if (!(typeof path === "string")) {
        path = undefined;
      }

      let to = setTimeout(() => {
        if (res.headersSent) return;
        res.json([]);
      }, config.torrentFilesTimeout || 10 * 1000);
      req.on("close", () => {
        clearTimeout(to);
      });
      stop = state.logger?.logTask(`fetching torrent : ${hash}`);

      let torrent = await state.streamer?.getTorrent(hash, { path });
      if (stop)
        stop(
          `Done!\nInfo Hash : ${hash}\nName : ${torrent?.name}\nFiles : ${torrent?.files.length}`,
        );
      clearTimeout(to);
      if (!torrent) {
        res.status(500).json({
          error: "inable to get torrent",
        });
        return;
      }
      let files = getTorrnetFiles(torrent);
      if (res.headersSent) return;
      res.status(200).json({
        name: torrent.name,
        path: torrent.path,
        files,
        torrentURL: torrent.torrentFileBlobURL,
        size: torrent.length,
      });
    } catch (err) {
      if (typeof stop === "function")
        stop("error while getting torrent " + err);
      console.log("error when requesting torrent files :", err);
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}
