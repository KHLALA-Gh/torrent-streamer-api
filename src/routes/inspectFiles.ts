import { Router } from "express";
import { HandlerConfig } from "../types/config";
import WebTorrent from "webtorrent";
import { TorrentMetaData } from "../types/torrent";

export function getFiles(router: Router, config: Partial<HandlerConfig>) {
  router.get("/api/torrents/:hash/files", (req, res) => {
    try {
      let hash = req.params.hash;
      let client = new WebTorrent();
      let to = setTimeout(() => {
        res.json([]);
      }, config.torrentFilesTimeout || 10 * 1000);
      req.on("close", () => {
        clearTimeout(to);
        client.destroy((err) => {
          if (!err) return;
          console.log(
            `error when destroying webtorrent client after getting files : ${err.toString()}`
          );
        });
      });
      client.on("error", (err) => {
        if (err.toString().includes("Invalid torrent identifier")) {
          res.status(400).json({
            error: "Invalid torrent hash.",
          });
        } else if (err.toString().includes("No peers found")) {
          res.status(400).json({
            error: "No peers found",
          });
        } else {
          res.status(500).json({
            error: "Internal Server Error",
          });
        }
      });
      client.add(hash, (torrent) => {
        let torrents: TorrentMetaData[] = [];
        torrent.files.map((t) => {
          torrents.push({
            name: t.name,
            path: t.path,
            size: t.length,
          });
        });
        res.status(200).json(torrents);
      });
    } catch (err) {
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}
