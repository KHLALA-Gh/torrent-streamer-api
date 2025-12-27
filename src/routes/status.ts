import { Router } from "express";
import { HandlerConfig, State } from "../types/config";

export function status(router: Router, config: HandlerConfig, _: State) {
  router.get("/api/status", async (req, res) => {
    res.json({
      status: config.ServerStatus,
    });
  });
}
