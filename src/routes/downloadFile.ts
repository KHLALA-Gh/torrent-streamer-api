import { Router } from "express";
import { HandlerConfig } from "../types/config.js";
import { StreamerErr, StreamerErrCode } from "../lib/streamer.js";
import { decodeToUTF8 } from "../lib/encoder.js";
import { nanoid } from "nanoid";
import requestIp from "request-ip";
import { State } from "../lib/state.js";
export function downloadFile(
  router: Router,
  config: HandlerConfig,
  state: State
) {
  router.get("/api/torrents/:hash/files/:path", async (req, res) => {
    try {
      const ip = requestIp.getClientIp(req) || "";
      let limit = config?.ipStreamLimit || 10;
      if (state?.openStreams.getIpStreamCount(ip) >= limit) {
        res.status(403).json({
          error: "you reached your stream limit",
        });
        return;
      }

      const path = decodeToUTF8(req.params.path);
      const hash = req.params.hash;
      const range = req.headers.range;
      let to = setTimeout(() => {
        if (!res.headersSent) {
          res.json({ error: "Request timeout" });
        }
      }, config?.torrentFilesTimeout || 10 * 1000);
      let streamID = nanoid();
      let fileDownload = await state.streamer.streamFile(
        hash,
        res,
        path,
        (fileDownload) => {
          state.openStreams.removeStreamAndLog(streamID);
          if (!state.openStreams.getTorrentCount(hash)) {
            fileDownload.softDestroy(config.destroyTorrentTimeout, () => {
              state.streamer.downloads.delete(fileDownload.id);
            });
          }
        },
        range
      );
      clearTimeout(to);
      if (!fileDownload) return;
      console.log("stream started file : " + fileDownload.file?.name);
      const url = new URL(
        "/api/streams/" + fileDownload.id,
        `http://${req.hostname}:${req.socket.localPort}`
      );
      fileDownload.streamUrl = url.href;
      state.setStream(streamID, {
        ip,
        preStream: false,
        infoHash: hash,
        fileDownload,
      });
    } catch (err) {
      console.log(err);
      if (err instanceof StreamerErr) {
        if (err.code === StreamerErrCode.INVALID_PATH) {
          res.status(400).json({ error: "Invalid file path" });
          return;
        }
        res.status(500).json({ error: "unexpected streaming error" });
        return;
      }
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  });
}
