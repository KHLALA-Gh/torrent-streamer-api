import { Router } from "express";
import torSearch from "torrent-search-api";
import { Torrent } from "../types/search.js";

torSearch.enableProvider("YTS");

const router = Router();

router.get("/api/search", async (req, res) => {
  const providers = req.query.providers;

  if (!providers || typeof providers != "string") {
    torSearch.enablePublicProviders();
  } else {
    torSearch.disableAllProviders();
    let pros = providers.split(",");
    for (let p of pros) {
      torSearch.enableProvider(p);
    }
  }
  let limit = req.query.limit;
  if (!limit || isNaN(+limit)) {
    limit = "20";
  }
  let cat = req.query.category;
  if (!cat || typeof cat != "string") {
    cat = "Movies";
  }
  let q = req.query.query;
  if (!q || typeof q != "string") {
    res.status(400).json({
      err: "please write query search",
    });
    return;
  }
  const torrents = await torSearch.search(q, cat, +limit);
  let magnets: Torrent[] = [];

  for (let torrent of torrents) {
    const magnet = await torSearch.getMagnet(torrent);
    const t: Torrent = {
      ...torrent,
      magnetURI: magnet,
    };
    magnets.push(t);
  }

  res.status(200).json(magnets);
});

export default router;
