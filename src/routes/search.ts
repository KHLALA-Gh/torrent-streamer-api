import { Router } from "express";
import { HandlerConfig } from "../types/config.js";
import TorrentAgent from "torrent-agent";
import { Torrent } from "torrent-agent/dist/scrapers/scraper.js";
import { DefaultScrapers } from "torrent-agent/dist/query.js";

export function search(router: Router, config: Partial<HandlerConfig>) {
  const agent = new TorrentAgent();
  router.get("/api/search", async (req, res) => {
    try {
      let limitQ = req.query.limit;
      let limit = 20;
      if (limitQ && !isNaN(+limitQ)) {
        limit = +limitQ;
      }
      let q = req.query.query;
      if (!q || typeof q != "string") {
        res.status(400).json({
          err: "please write query search",
        });
        return;
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const query = agent.add({
        searchQuery: q,
        options: {
          limit: limit,
          concurrency: 10,
        },
        scrapers: DefaultScrapers,
      });

      query.on("torrent", (t) => {
        res.write(`data: ${JSON.stringify(t)}\n\n`);
      });
      query.on("done", () => {
        res.end();
      });
    } catch (err) {
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}
