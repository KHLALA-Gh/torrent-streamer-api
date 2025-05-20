import { Router } from "express";
import { HandlerConfig, State } from "../types/config.js";
import {
  contentType,
  Streamer,
  StreamerErr,
  StreamerErrCode,
} from "../lib/streamer.js";
import { createMagnetLink } from "./magnet.js";
import { trackers, wsTrackers } from "../trackers.js";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";

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
      res.status(200).json({
        ...download.getFile(),
        streamUrl: url.href,
      });
      return;
    }
    const magnetURI = createMagnetLink(hash, trackers, wsTrackers);
    const id = randomUUID();
    const fileDownload = await state.streamer.download(
      id,
      magnetURI,
      filePath,
      state.cache.dirPath
    );
    fileDownload.on("error", (err) => {
      console.log(err);
      if (res.headersSent) return;
      if (
        err instanceof StreamerErr &&
        err.code === StreamerErrCode.FILE_NOTFOUND
      ) {
        res.status(404).json({
          err: "file not found in the torrent",
        });
        return;
      }
      res.status(500).json({
        err: "unknown error",
      });
      return;
    });
    fileDownload.once("file", (torrent, file) => {
      const url = new URL(
        "/api/streams/" + id,
        `http://${req.hostname}:${req.socket.localPort}`
      );
      fileDownload.streamUrl = url.href;
      res.status(200).json({
        ...fileDownload.getFile(),
        streamUrl: url.href,
      });
    });
    fileDownload.on("done", () => {
      console.log("file downloaded : " + fileDownload.file?.name);
    });
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
      let stream = state.streamer.streamDownlaod(id, res, range);
      let streamID = nanoid();
      let ip = req.ip || "";
      if (ip === "::1") {
        ip = "127.0.0.1";
      }
      state.openStreams.setStreamAndLog(streamID, {
        infoHash: state.streamer.downloads.get(id)?.torrent?.infoHash || "",
        ip,
      });

      req.on("close", () => {
        //@ts-ignore
        stream.destroy((err) => {
          if (err) {
            console.log("error when closing stream : ", err);
            return;
          }
          state.openStreams.removeStreamAndLog(id);
          console.log("stream destroyed");
        });
      });
      stream.on("close", () => {
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
      state.openStreams.removeStream(id);
      console.clear();
      console.table(state.openStreams.ipOpenStreamsTable());
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
    }
  });
}
