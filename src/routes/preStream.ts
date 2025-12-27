import { Router } from "express";
import { HandlerConfig } from "../types/config.js";
import { StreamerErr, StreamerErrCode } from "../lib/streamer.js";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { getClientIp } from "request-ip";
import { State } from "../lib/state.js";

export function setPreStream(
  router: Router,
  _: Partial<HandlerConfig>,
  state: State
) {
  router.post("/api/streams", async (req, res) => {
    let hash = req.body.hash;
    let filePath = req.body.filePath;
    const download = state.streamer.getDownloadByPathAndHash(hash, filePath);
    if (download) {
      const url = new URL(
        "/api/streams/" + download.id,
        `http://${req.hostname}:${req.socket.localPort}`
      );
      download.file?.select();
      res.status(200).json({
        ...download.getFile(),
        streamUrl: url.href,
      });
      return;
    }
    const id = randomUUID();
    state.streamer.download(
      id,
      hash,
      filePath,
      state.cache.dirPath,
      (fileDownload) => {
        const url = new URL(
          "/api/streams/" + id,
          `http://${req.hostname}:${req.socket.localPort}`
        );
        fileDownload.streamUrl = url.href;
        state.setStream(id, {
          ip: req.ip || "",
          infoHash: hash,
          preStream: true,
          fileDownload,
        });
        res.status(200).json({
          ...fileDownload.getFile(),
          streamUrl: url.href,
        });
      }
    );
  });
}

export function getPreStream(
  router: Router,
  _: Partial<HandlerConfig>,
  state: State
) {
  router.get("/api/streams/:id", (req, res): any => {
    try {
      const id = req.params.id;
      const range = req.headers.range;
      let streamID = nanoid();

      let stream = state.streamer.streamDownlaod(
        id,
        res,
        range,
        (fileDownload) => {
          let ip = getClientIp(req) || "";
          state.setStream(streamID, {
            infoHash: state.streamer.downloads.get(id)?.torrent?.infoHash || "",
            ip,
            fileDownload,
          });
        }
      );

      res.on("close", () => {
        //@ts-ignore
        stream.destroy((err) => {
          if (err) {
            console.log("error when closing stream : ", err);
            return;
          }
          state.removeStream(streamID);
          console.log("stream destroyed");
        });
      });
      stream.on("close", () => {
        state.removeStream(streamID);
        console.log("stream closed");
      });
    } catch (err) {
      if (err instanceof StreamerErr) {
        console.log(err.error());
      }
    }
  });
}

export function getPreStreams(
  router: Router,
  _: Partial<HandlerConfig>,
  state: State
) {
  router.get("/api/streams/", (req, res) => {
    const files = state.streamer.getDownloads();
    res.status(200).json(files);
  });
}

export function stopPreStream(
  router: Router,
  _: Partial<HandlerConfig>,
  state: State
) {
  router.delete("/api/streams/:id", async (req, res) => {
    try {
      const id = req.params.id;
      await state.streamer.stopDownload(id);
      state.streamer.downloads.delete(id);
      state.removeStream(id);
      res.sendStatus(200);
    } catch (err) {
      if (
        err instanceof StreamerErr &&
        err.code === StreamerErrCode.DOWNLOAD_ID_NOTFOUND
      ) {
        res.status(404).json({
          err: "stream not found",
        });
        return;
      }
      res.status(500).json({
        err: "server error",
      });
      console.log("unknown error when stopping stream : ", err);
    }
  });
}
