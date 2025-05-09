import { Router } from "express";
import { HandlerConfig, State } from "../types/config.js";
import { Streamer, StreamerErr, StreamerErrCode } from "../lib/streamer.js";
import { createMagnetLink } from "./magnet.js";
import { trackers, wsTrackers } from "../trackers.js";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

export function setPreStream(
  router: Router,
  _: Partial<HandlerConfig>,
  state: State
) {
  router.post("/api/streams", async (req, res) => {
    let hash = req.body.hash;
    let filePath = req.body.filePath;
    const file = state.openStreams.getFileByPathAndHash(hash, filePath);
    if (file) {
      const url = new URL(
        "/api/streams/" + file.id,
        `http://${req.hostname}:${req.socket.localPort}`
      );
      res.status(200).json({
        ...file,
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
    fileDownload.on("progress", (progress) => {
      state.openStreams.updateFile(id, {
        progress,
      });
    });
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
      state.openStreams.setStream(id, {
        id: id,
        hash: hash,
        path: file.path,
        name: torrent.name,
        size: torrent.length,
        preStream: true,
      });
      console.clear();
      console.table(state.openStreams.ipOpenStreamsTable());
      const url = new URL(
        "/api/streams/" + id,
        `http://${req.hostname}:${req.socket.localPort}`
      );
      res.status(200).json({
        name: torrent.name,
        size: file.length,
        path: file.path,
        progress: file.progress,
        streamUrl: url.href,
      });
    });
    fileDownload.on("done", () => {
      console.log("file download : " + fileDownload.file?.name);
      state.openStreams.updateFile(id, { downloaded: true });
      state.openStreams.removeStream(id, id);
    });
  });
}

export function getPreStream(
  router: Router,
  _: Partial<HandlerConfig>,
  state: State
) {
  router.get("/api/streams/:id", (req, res) => {
    const id = req.params.id;

    const file = state.openStreams.getFile(id);
    if (!file) {
      res.status(404).json({
        err: "stream not found",
      });
      return;
    }
    const videoPath = path.resolve(state.cache.dirPath, file.path);
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4",
      });

      stream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      });

      fs.createReadStream(videoPath).pipe(res);
    }
  });
}

export function getPreStreams(
  router: Router,
  _: Partial<HandlerConfig>,
  state: State
) {
  router.get("/api/streams/", (req, res) => {
    const streams = state.openStreams.getFiles();
    res.status(200).json(streams);
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
