import { Response } from "express";
import WebTorrent from "webtorrent";
import Webtorrent from "webtorrent";
import { StreamState } from "../types/config.js";
import ffmpeg from "fluent-ffmpeg";
import { TorrentFile } from "../types/torrent.js";
import EventEmitter from "events";
import { createMagnetLink } from "../routes/magnet.js";
import { trackers, wsTrackers } from "../trackers.js";
import { randomUUID } from "crypto";
import { pipeline } from "stream";
export enum StreamerErrCode {
  "MP4FILE_NOTFOUND",
  "INVALID_PATH",
  "FILE_NOTFOUND",
  "DOWNLOAD_NOTFOUND",
  "TORRENT_NOTFOUND",
}
import fs from "fs";
import os from "os";
import path from "path";
export class StreamerErr extends Error {
  code: StreamerErrCode;
  constructor(msg: string, code: StreamerErrCode) {
    super(msg);
    this.code = code;
  }
  error(): string {
    return `${this.code} : ${this.message}`;
  }
}

export const contentType: { [T: string]: string } = {
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  mpg: "video/mpeg",
};
function sameRealPath(a: string, b: string) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return false;
  }
}
export class Streamer extends Webtorrent {
  public downloads: Map<string, Download>;
  constructor() {
    super();
    this.downloads = new Map();
    this.on("error", (err) => {
      console.log(err);
    });
  }
  destroyStreamer(callback?: (err: Error | string) => void): void {
    this.destroy((err) => {
      if (!err) {
        this.downloads.clear();
      }
      if (callback) callback(err);
    });
  }
  async getTorrent(
    hash: string,
    opts?: WebTorrent.TorrentOptions,
  ): Promise<WebTorrent.Torrent> {
    let torrent = await this.get(hash);
    if (torrent && !torrent.name) {
      torrent = await new Promise<WebTorrent.Torrent>((res, rej) => {
        if (!torrent) return rej("torrent is undefined");
        torrent.once("ready", () => {
          if (!torrent) return rej();

          res(torrent);
        });
        torrent.once("error", (err) => rej(err));
      });
    }
    if (torrent && torrent.name) return torrent;
    torrent = await new Promise<WebTorrent.Torrent>((res, rej) => {
      torrent = this.add(
        createMagnetLink(hash, trackers, wsTrackers),
        opts,
        (torrent) => {
          torrent.files.forEach((file) => file.deselect());
        },
      );
      torrent.once("ready", () => {
        if (!torrent) return rej();

        res(torrent);
      });
      torrent.once("error", (err) => rej(err));
    });

    return torrent;
  }
  /**@deprecated */
  stream(
    magnetURI: string,
    res: Response,
    filePath?: string,
    range?: string,
    callback?: (file: WebTorrent.TorrentFile) => boolean,
  ) {
    let torrent = this.add(magnetURI, (torrent) => {
      if (filePath && !filePath.endsWith(".mp4")) {
        res.status(400).json({
          error: "the provided file is not an mp4 file.",
        });
        return;
      }
      const file = torrent.files.find((f) => {
        if (filePath) {
          return f.path === filePath;
        } else {
          return f.name.endsWith(".mp4");
        }
      });

      if (!file) {
        console.log("MP4 file not found for info hash : " + torrent.infoHash);
        res.status(404).json({
          error: "MP4 file not found for info hash : " + torrent.infoHash,
        });
        return;
      }
      if (callback && !callback(file)) {
        return;
      }
      if (!range) {
        const start = 0;
        const end = file.length - 1;
        const stream = file.createReadStream({ start, end });

        res.writeHead(200, {
          "Content-Length": file.length,
          "Content-Type": "video/mp4",
        });

        stream.pipe(res);
        stream.on("error", (err) => {
          console.error("Stream error:", err);
          res.end();
        });
      } else {
        const positions = range.replace(/bytes=/, "").split("-");
        const start = parseInt(positions[0], 10);
        const end = positions[1] ? parseInt(positions[1], 10) : file.length - 1;

        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${file.length}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/mp4",
        });
        const stream = file.createReadStream({ start, end });
        stream.pipe(res);

        stream.on("error", (err) => {
          console.error("Stream error:", err);
          res.end();
        });
      }
    });
    return torrent;
  }
  async streamFile(
    hash: string,
    res: Response,
    path: string | ((file: WebTorrent.TorrentFile) => boolean),
    cleanup: (torrent: Download) => void,
    range?: string,
  ): Promise<{
    torrent: WebTorrent.Torrent;
    download: Download;
    file: WebTorrent.TorrentFile;
  }> {
    if (!path) {
      throw new StreamerErr(
        `${path} path is invalid`,
        StreamerErrCode.INVALID_PATH,
      );
    }
    let torrent = await this.getTorrent(hash);

    let file: WebTorrent.TorrentFile | undefined;

    torrent.files.forEach((f) => {
      if (typeof path === "string") {
        if (f.path === path) {
          file = f;
          return;
        }
      } else {
        if (path(f)) {
          file = f;
          return;
        }
      }
    });
    if (!file) {
      console.log(`file not found for info hash : ${torrent.infoHash}`);
      res.status(404).json({
        error: "file not found for info hash : " + torrent.infoHash,
      });
      throw new StreamerErr("file not found", StreamerErrCode.FILE_NOTFOUND);
    }
    let download = this.downloads.get(hash);
    if (!download) {
      download = new Download({ hash, selectedFiles: [file.path] });
      this.downloads.set(hash, download);
      this.emit("download", download);
      download.selectFile(file);
    }
    console.log("found : " + file.name);
    if (res.headersSent) throw new Error("response already sent");
    let metadata = Download.getStreamMetaData(file, range);
    res.writeHead(range ? 206 : 200, {
      "Content-Range": `bytes ${metadata.start}-${metadata.end}/${file.length}`,
      "Accept-Ranges": "bytes",
      "Content-Length": metadata.chunkSize,
      "Content-Type": metadata.contentType,
      "Content-Disposition": `attachment; filename="${file.name}"`,
    });
    download.streamFile(res, file, cleanup, range);
    return { torrent, file, download };
  }
  async experimental_streamMKV(
    hash: string,
    res: Response,
    path?: string,
    callback?: (file: Download) => boolean,
  ) {
    let torrent = await this.getTorrent(hash);

    const file = torrent.files.find(
      (f) => path === f?.path || (!path && f.name.endsWith(".mkv")),
    );
    if (!file) {
      res.status(404).json({
        error: "mkv file not found",
      });
      return;
    }
    let download = new Download({ hash, selectedFiles: [file.path] });
    if (typeof callback === "function") {
      let cont = callback(download);
      if (!cont) return;
    }
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Transfer-Encoding": "chunked",
      "Accept-Ranges": "none",
    });
    const stream = file.createReadStream();
    //@ts-ignore
    ffmpeg(stream)
      .videoCodec("copy")
      .audioCodec("aac")
      .format("mp4")
      .videoCodec("libx264")
      .outputOptions("-movflags frag_keyframe+empty_moov")
      .on("error", (err) => console.error("ffmpeg error", err))
      .pipe(res, { end: true });
    return { download, torrent };
  }
  async download(
    hash: string,
    filePath: string,
    downloadPath: string,
  ): Promise<Download> {
    let torrent = await this.getTorrent(hash, { path: downloadPath });
    const download = new Download({ hash, selectedFiles: [filePath] });
    this.downloads.set(hash, download);
    this.emit("download", download);
    download.emit("torrent", torrent);

    let selectedCount = download.applySelection(torrent);
    if (!selectedCount) {
      throw new StreamerErr(
        `${filePath} is not found in the torrent with info hash : ${torrent.infoHash}`,
        StreamerErrCode.FILE_NOTFOUND,
      );
    }
    console.log(`Downloading: ${torrent.name}`);

    torrent.on("done", () => {
      console.log("Torrent download finished!");
      download.emit("done");
      download.removeAllListeners();
      download.downloaded = true;
    });
    torrent.on("error", (err) => {
      if (typeof err === "string") {
        download.emit("error", new Error(err));

        return;
      }
      download.emit("error", err);
    });

    return download;
  }
  async downloadTorrent(
    infoHash: string,
    opts: WebTorrent.TorrentOptions,
    cb?: (t: WebTorrent.Torrent) => void,
  ) {
    const t = await this.get(infoHash);
    if (t) {
      const tmpPath = opts.path || path.join(os.tmpdir(), "./webtorrent");
      const oldTorrentPath = path.join(t.path, t.name);
      const newTorrentPath = path.join(opts.path || tmpPath, t.name);
      if (sameRealPath(oldTorrentPath, newTorrentPath))
        throw new Error("already downloading");
      await new Promise<void>((res, rej) =>
        t.destroy({}, (err) => {
          if (err) return rej(err);
          res();
        }),
      );
      fs.cpSync(oldTorrentPath, newTorrentPath, {
        recursive: true,
        force: true,
      });
      fs.rmSync(oldTorrentPath, { recursive: true, force: true });
    }
    this.add(infoHash, opts, (t: WebTorrent.Torrent) => {
      t.select(0, t.pieces.length - 1);
      const download = new Download({
        hash: infoHash,
        selectedFiles: t.files.map((f) => f.path),
        path: opts.path,
      });
      download.type = "torrent";
      this.downloads.set(infoHash, download);
      if (cb) cb(t);
    });
  }
  async stopDownload(hash: string, files?: []) {
    let download = this.downloads.get(hash);
    if (!download) {
      throw new StreamerErr(
        "download not found",
        StreamerErrCode.DOWNLOAD_NOTFOUND,
      );
    }
    const torrent = await this.get(hash);
    if (!torrent) {
      throw new StreamerErr(
        "torrent not found",
        StreamerErrCode.TORRENT_NOTFOUND,
      );
    }
    files?.forEach((p) => {
      download.selectedFiles.delete(path.resolve(p));
    });
    download.applySelection(torrent);
  }
  async getDownloadsFiles(): Promise<TorrentFile[]> {
    let downloads = this.downloads.values().toArray();
    let files: TorrentFile[] = [];
    for (let d of downloads) {
      const torrent = await this.get(d.infoHash);
      if (!torrent) continue;
      torrent.files.forEach((f) => {
        if (d.selectedFiles.has(path.resolve(f.path))) {
          files.push({
            name: f.name,
            path: d.path || f.path,
            size: f.length,
            torrentHash: d.infoHash,
            progress: f.progress,
            streamUrl: d.streamUrl,
          });
        }
      });
    }
    return files;
  }
}

interface DownloadEvents {
  file: [torrent: Webtorrent.Torrent, file: WebTorrent.TorrentFile];
  torrent: [torrent: Webtorrent.Torrent];
  stream: [stream: NodeJS.ReadableStream];
  error: [err: Error];
  done: [];
  destroy: [];
}
interface DownloadOpts {
  hash: string;
  path?: string;
  selectedFiles: string[];
}
export class Download extends EventEmitter<DownloadEvents> {
  selectedFiles: Set<string>;
  infoHash: string;
  path?: string;
  streamUrl?: string;
  downloaded?: boolean;
  type?: "torrent" | "file";
  constructor({ hash, selectedFiles, path: torrentPath }: DownloadOpts) {
    super();
    this.infoHash = hash;
    this.selectedFiles = new Set(selectedFiles) ?? new Set();
    this.path = torrentPath ? path.resolve(torrentPath) : undefined;
  }
  applySelection(torrent: WebTorrent.Torrent) {
    let selectCount = 0;
    torrent.files.forEach((file) => {
      if (this.selectedFiles.has(file.path)) {
        selectCount++;
        file.select();
      } else {
        file.deselect();
      }
    });
    return selectCount;
  }

  selectFile(file: WebTorrent.TorrentFile) {
    file.select();
    this.selectedFiles.add(file.path);
  }

  deselectFile(file: WebTorrent.TorrentFile) {
    file.deselect();
    this.selectedFiles.delete(file.path);
  }
  pauseFiles(torrent: WebTorrent.Torrent, files?: string[]) {
    const filesSet = new Set(files || torrent.files.map((f) => f.path));
    torrent.files.forEach((f) => {
      if (filesSet.has(f.path)) {
        f.deselect();
      }
    });
  }
  streamFile(
    destination: any,
    file: WebTorrent.TorrentFile,
    cleanup: (download: Download) => void,
    range?: string,
  ): NodeJS.ReadableStream {
    if (!file) {
      throw new Error("file is not defined");
    }
    let stream;
    if (!range) {
      const start = 0;
      const end = file.length - 1;
      stream = file.createReadStream({ start, end });
    } else {
      const positions = range.replace(/bytes=/, "").split("-");
      const start = parseInt(positions[0], 10);
      const end = positions[1] ? parseInt(positions[1], 10) : file.length - 1;
      stream = file.createReadStream({ start, end });
    }
    pipeline(stream, destination, (err: any) => {
      if (err) {
        if (err.message.includes("prematurely")) {
          console.log(`Client closed stream early for "${file?.name}"`);
        } else {
          console.error(`Stream error when streaming "${file?.name}":`, err);
        }
      } else {
        console.log(`Stream finished successfully for "${file?.name}"`);
      }
      cleanup(this);
    });
    this.emit("stream", stream);
    return stream;
  }
  /**
   * It doesn't destroy the download file immediately. It waits for new streams.
   * If there are no new streams after a certain period of time,
   * the torrent will be destroyed.
   */
  softDestroy(
    torrent: WebTorrent.Torrent,
    durationToDestroy: number,
    cb?: () => void,
  ) {
    if (torrent) {
      try {
        torrent.deselect(0, torrent.pieces.length - 1, 0);
      } catch (err) {
        console.log("failed to deselect the torrent : ", err);
      }
    }
    let destroyTorrentTimeout = setTimeout(() => {
      torrent.destroy({}, (err) => {
        if (err) {
          console.log("error when destroying torrent : " + err);
          return;
        }
        console.log("torrent destroyed");
      });
      if (cb) cb();
      this.emit("destroy");
    }, durationToDestroy);
    this.once("destroy", () => {
      clearTimeout(destroyTorrentTimeout);
    });
    this.once("stream", () => {
      clearTimeout(destroyTorrentTimeout);
    });
  }
  static getStreamMetaData(
    file: Webtorrent.TorrentFile,
    range?: string,
  ): StreamMetadata {
    let fileExt = file.name.split(".").pop() || "";
    let contentTypeValue = contentType[fileExt] || "application/octet-stream";
    if (range) {
      const positions = range.replace(/bytes=/, "").split("-");
      const start = parseInt(positions[0], 10);
      const end = positions[1]
        ? parseInt(positions[1], 10)
        : Math.max(file.length - 1, 0);

      const chunkSize = end - start + 1;
      return {
        start,
        end,
        chunkSize,
        contentType: contentTypeValue,
      };
    } else {
      return {
        start: 0,
        end: file.length || 0 - 1,
        chunkSize: file.length || 0,
        contentType: contentTypeValue,
      };
    }
  }
}
interface StreamMetadata {
  chunkSize: number;
  start: number;
  end: number;
  contentType: string;
}
export class StreamsState {
  public openStreams: Map<string, StreamState>;
  constructor() {
    this.openStreams = new Map<string, StreamState>();
  }
  logFetchingTorrentData(hash: string): (msg?: string) => void {
    const spinner = ["|", "/", "-", "\\"];
    let i = 0;

    const interval = setInterval(() => {
      process.stdout.write(
        "\r" + spinner[i++ % spinner.length] + "fetching torrent : " + hash,
      );
    }, 100);
    return (msg) => {
      clearInterval(interval);
      if (msg) {
        process.stdout.write(`\r${msg}\n`);
      }
    };
  }
  getIpStreamCount(ip: string): number {
    let count = 0;
    this.openStreams.values().forEach((v) => (v.ip === ip ? count++ : null));

    return count;
  }
  setStreamAndLog(id: string, streamInfo: StreamState) {
    this.setStream(id, streamInfo);
    console.clear();
    console.table(this.ipOpenStreamsTable());
  }
  removeStreamAndLog(id: string) {
    this.removeStream(id);
    console.clear();
    console.table(this.ipOpenStreamsTable());
  }
  setStream(id: string, streamInfo: StreamState) {
    this.openStreams.set(id, streamInfo);
  }
  ipOpenStreamsTable(): {
    id: string;
    ip: string;
    prestream: boolean;
    paused?: boolean;
  }[] {
    let table: {
      id: string;
      ip: string;
      prestream: boolean;
      paused?: boolean;
    }[] = [];
    this.openStreams.forEach((v, id) => {
      table.push({
        id,
        ip: v.ip,
        prestream: v.preStream || false,
      });
    });
    return table;
  }
  removeStream(id: string) {
    this.openStreams.delete(id);
  }
  getTorrentCount(hash: string): number {
    let count = 0;
    this.openStreams.forEach((s) => {
      if (s.infoHash === hash) count++;
    });
    return count;
  }
  clear() {
    this.openStreams.clear();
  }
}
