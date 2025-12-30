import { Router } from "express";
import { HandlerConfig } from "../types/config";
import { State } from "../lib/state";

export function verifyState(
  router: Router,
  config: Partial<HandlerConfig>,
  state: State
) {
  router.use((req, res, next) => {
    if (state.destroyed) {
      res.status(503).json({
        error: "Service Unavailable",
      });
      return;
    }
    next();
  });
}
