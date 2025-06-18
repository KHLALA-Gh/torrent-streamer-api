import { Router } from "express";
import { HandlerConfig } from "../types/config.js";
import TorrentAgent from "torrent-agent";

export function search(router: Router, config: Partial<HandlerConfig>) {
  const agent = new TorrentAgent({
    QueriesConcurrency: config.queryConcurrency,
  });
  router.get("/api/search", async (req, res) => {
    try {
      let limit = config.defaultSearchLimit || 20;
      if (config.chooseSearchLimit) {
        let limitQ = req.query.limit;
        if (limitQ && !isNaN(+limitQ)) {
          limit = +limitQ;
        }
      }
      limit =
        (config.maxSearchLimit || 100) < limit
          ? config.maxSearchLimit || 100
          : limit;
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
          concurrency: config.searchConcurrency || 5,
        },
      });

      query.on("torrent", (t) => {
        res.write(`data: ${JSON.stringify(t)}\n\n`);
      });
      query.on("error", (err) => {
        console.log("error :", err.message);
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
