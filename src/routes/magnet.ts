import { Router } from "express";
import { trackers } from "../trackers.js";

function createMagnetLink(
  infoHash: string,
  trackers: string[] = [],
  ws: string[] = []
) {
  let magnetLink = `magnet:?xt=urn:btih:${infoHash}`;

  trackers.forEach((tracker) => {
    magnetLink += `&tr=${encodeURIComponent(tracker)}`;
  });
  ws.forEach((ws) => {
    magnetLink += `&ws=${encodeURIComponent(ws)}`;
  });
  return magnetLink;
}

export function getMagnet(router: Router, config: Partial<HandlerConfig>) {
  router.get("/api/get_magnet_uri", async (req, res) => {
    const hash = req.query.hash;
    if (typeof hash != "string") {
      res.status(400).json({
        err: "torrent hash is required",
      });
      return;
    }

    try {
      const magnetURI = createMagnetLink(hash, trackers);

      res.status(200).json({
        magnetURI,
      });
    } catch (err) {
      console.log("error when gettin magnet uri : ", err);
      res.status(500).json({
        err: "server error",
      });
    }
  });
}

export default getMagnet;
