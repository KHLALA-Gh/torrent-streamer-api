import { Router } from "express";
import { State } from "../lib/state";
import { HandlerConfig } from "../types/config";

export function downloadTorrent(
  router: Router,
  config: HandlerConfig,
  state: State,
) {
  router.post("/api/torrents/:hash/download", async (req, res) => {
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
    let findTorrent = false;
    let torrentPath: string | undefined;
    state.streamer?.downloads.forEach((d) => {
      if (
        d.type === "torrent" &&
        d.infoHash.toLowerCase() === hash.toLowerCase()
      ) {
        findTorrent = true;
        torrentPath = d.path;
      }
    });
    if (findTorrent) {
      res.status(208).json({
        err: "torrent already being downloaded in " + path,
      });
      return;
    }
    await state.streamer?.downloadTorrent(hash, { path }, (t) => {
      res.sendStatus(200);
    });
  });
}
