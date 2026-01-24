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
  state: State,
) {
  router.get("/api/torrents/:hash/files/:path", async (req, res) => {
    try {
      const ip = requestIp.getClientIp(req) || "";
      let limit = config?.ipStreamLimit || 10;
      if ((state?.openStreams?.getIpStreamCount(ip) || 0) >= limit) {
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
      let { download, torrent, file } = await state.streamer?.streamFile(
        hash,
        res,
        path,
        (d) => {
          state.openStreams?.removeStreamAndLog(streamID);
          if (
            !state.openStreams?.getTorrentCount(torrent.infoHash) &&
            d.type === "stream"
          ) {
            download.pauseFiles(torrent);
          }
          if (
            !state.openStreams?.getFileStreamCount(torrent.infoHash, file.path)
          ) {
            let t = setTimeout(() => {
              if (
                state.openStreams?.getFileStreamCount(
                  torrent.infoHash,
                  file.path,
                )
              )
                return;
              const f = d.files.get(file.path);
              d.files.set(file.path, {
                paused: f?.paused || false,
                selected: f?.selected || false,
                streamed: false,
              });
            }, 20_000);
            d.once("stream", (_, f) => {
              if (file.path === f.path) clearTimeout(t);
            });
          }
        },
        range,
      );
      clearTimeout(to);
      console.log("stream started file : " + file.name);
      state.setStream(streamID, {
        ip,
        preStream: false,
        infoHash: hash,
        filePath: file.path,
      });
    } catch (err) {
      console.log(err);
      if (err instanceof StreamerErr) {
        if (err.code === StreamerErrCode.INVALID_PATH) {
          res.status(400).json({ error: "Invalid file path" });
          return;
        }
        if (err.code === StreamerErrCode.TORRENT_STOPPED) {
          res.status(400).json({ error: "Torrent stopped" });
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
