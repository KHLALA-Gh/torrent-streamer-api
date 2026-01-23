import { Response } from "express";
import WebTorrent from "webtorrent";
import Webtorrent from "webtorrent";
import { StreamState } from "../types/config.js";
import ffmpeg from "fluent-ffmpeg";
import { File, TorrentFile } from "../types/torrent.js";
import EventEmitter from "events";
import { createMagnetLink } from "../routes/magnet.js";
import { trackers, wsTrackers } from "../trackers.js";
import { pipeline } from "stream";
export enum StreamerErrCode {
  "MP4FILE_NOTFOUND",
  "INVALID_PATH",
  "FILE_NOTFOUND",
  "DOWNLOAD_NOTFOUND",
  "TORRENT_NOTFOUND",
  "TORRENT_STOPPED",
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
  public defaultTorrentPath: string = path.join(os.tmpdir(), "./homecinema");
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
    let download = new Download({
      infoHash: hash,
      selectedFiles: [],
      status: "setting",
      torrent: undefined,
    });
    if (!torrent) {
      this.saveDownload(download);
    }
    if (torrent && !torrent.name) {
      torrent = await new Promise<WebTorrent.Torrent>((res, rej) => {
        if (!torrent) return rej("torrent is undefined");
        torrent.once("ready", () => {
          if (!torrent) {
            download.status = "error";
            return rej();
          }

          res(torrent);
        });
        torrent.once("error", (err) => rej(err));
      });
    }
    if (torrent && torrent.name) {
      return torrent;
    }
    torrent = await new Promise<WebTorrent.Torrent>((res, rej) => {
      torrent = this.add(
        createMagnetLink(hash, trackers, wsTrackers),
        {
          ...opts,
          path: opts?.path || this.defaultTorrentPath,
        },
        (torrent) => {
          torrent.files.forEach((file) => file.deselect());
          this.deleteDownload(download.infoHash);
        },
      );
      torrent.once("ready", () => {
        if (!torrent) return rej();

        res(torrent);
      });
      torrent.once("error", (err) => {
        rej(err);
      });
    });

    return torrent;
  }
  saveDownload(d: Download) {
    d.infoHash = d.infoHash.toLowerCase();
    this.downloads.set(d.infoHash, d);
  }
  getDownload(hash: string) {
    return (
      this.downloads.get(hash.toLowerCase()) ||
      this.downloads.get(hash.toUpperCase())
    );
  }
  deleteDownload(hash: string) {
    return (
      this.downloads.delete(hash.toLowerCase()) ||
      this.downloads.delete(hash.toUpperCase())
    );
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
    let download = this.getDownload(hash);
    if (download?.stopped) {
      throw new StreamerErr("torrent stopped", StreamerErrCode.TORRENT_STOPPED);
    }
    if (!download) {
      download = new Download({
        selectedFiles: [file.path],
        status: "setted",
        infoHash: torrent.infoHash,
        torrent,
      });
      this.saveDownload(download);
      this.emit("download", download);
      download.applySelection(torrent);
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
    let download = new Download({
      selectedFiles: [file.path],
      status: "setted",
      infoHash: torrent.infoHash,
      torrent,
    });
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
    const download = new Download({
      selectedFiles: [filePath],
      status: "setting",
      infoHash: torrent.infoHash,
      torrent,
    });
    this.saveDownload(download);
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
    {
      infoHash,
      opts,
      files,
      stopped,
      paused,
    }: {
      infoHash: string;
      opts: WebTorrent.TorrentOptions;
      files?: string[];
      stopped?: boolean;
      paused?: boolean;
    },
    cb?: (t: WebTorrent.Torrent) => void,
  ) {
    const d = new Download({
      selectedFiles: [],
      infoHash: infoHash,
      status: "setting",
      type: "torrent",
      torrent: undefined,
    });
    this.saveDownload(d);
    const t = await this.get(infoHash);
    if (t) {
      const oldTorrentPath = path.join(t.path, t.name);
      const newTorrentPath = path.join(
        opts.path || this.defaultTorrentPath,
        t.name,
      );
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
    let torrent = this.add(infoHash, opts, (t: WebTorrent.Torrent) => {
      const download = new Download({
        selectedFiles: files || t.files.map((f) => f.path),
        status: "setted",
        infoHash: t.infoHash,
        torrent,
      });
      if (stopped) {
        download.stop(t);
      } else if (paused) {
        download.pauseFiles(t);
      } else {
        download.applySelection(t);
      }
      download.type = "torrent";
      this.saveDownload(download);
      if (cb) cb(t);
    });
    torrent.on("error", (err) => {
      const download = new Download({
        selectedFiles: [],
        status: "error",
        infoHash: infoHash,
        torrent: undefined,
      });
      this.saveDownload(download);
    });
  }
  async stopDownload(hash: string, files?: string[]) {
    let download = this.getDownload(hash);
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
    download.pauseFiles(torrent, files);
  }
  async getDownloadsFiles(): Promise<TorrentFile[]> {
    let downloads = this.downloads.values().toArray();
    let files: TorrentFile[] = [];
    for (let d of downloads) {
      const torrent = await this.get(d.infoHash);
      if (!torrent) continue;
      torrent.files.forEach((f) => {
        if (d.files.has(f.path)) {
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
export type downloadType = "torrent" | "stream";
export type DownloadStatus = "setted" | "setting" | "error";
export interface DownloadOpts<S extends DownloadStatus> {
  selectedFiles: string[];
  type?: downloadType;
  status: S;
  torrent: S extends "setted" ? Webtorrent.Torrent : undefined;
  infoHash: string;
}
export interface DownloadFile {
  selected: boolean;
  paused: boolean;
  streamed: boolean;
}
export class Download extends EventEmitter<DownloadEvents> {
  files: Map<string, DownloadFile>;
  infoHash: string;
  path: string;
  streamUrl?: string;
  downloaded?: boolean;
  type: downloadType;
  stopped: boolean;
  status: DownloadStatus;
  constructor({
    selectedFiles,
    type,
    torrent,
    infoHash,
    status,
  }: DownloadOpts<DownloadStatus>) {
    super();
    this.infoHash = infoHash;
    const selectedF = new Set(selectedFiles);

    if (!torrent) {
      if (status === "setted") throw new Error("setted without torrent");
      this.status = status || "setting";
      this.files = new Map();
      this.path = "";
    } else {
      this.path = path.resolve(torrent.path);
      this.status = status || "setted";
      this.files = new Map(
        torrent.files.map((f) => {
          return [
            f.path,
            {
              selected: selectedF.has(f.path),
              paused: false,
              streamed: false,
            },
          ];
        }),
      );
    }

    this.type = type || "stream";
    this.stopped = false;
  }
  isPaused(): boolean {
    for (let f of this.files.values()) {
      if (!f.paused || f.streamed) return false;
    }
    return true;
  }
  isDeselected(): boolean {
    for (let f of this.files.values()) {
      if (f.selected || f.streamed) return false;
    }
    return true;
  }
  getFiles(torrent: WebTorrent.Torrent): File[] {
    let files: File[] = [];
    for (let f of torrent.files) {
      const file = this.files.get(f.path);
      if (file) {
        files.push({
          ...file,
          path: f.path,
          progress: f.progress,
        });
      }
    }
    return files;
  }
  /**
   * pauses all files and stop streams
   */
  stop(torrent: WebTorrent.Torrent) {
    this.pauseFiles(torrent);
    this.files.forEach((f, hash) => {
      this.files.set(hash, {
        ...f,
        streamed: false,
      });
    });
    this.emit("stop");
    this.stopped = true;
  }
  applySelection(torrent: WebTorrent.Torrent) {
    if (this.stopped) throw new Error("download is stopped");
    let selectCount = 0;
    torrent.files.forEach((file) => {
      if (this.files.get(file.path)?.selected) {
        selectCount++;
        file.select();
      } else {
        file.deselect();
      }
    });
    return selectCount;
  }

  selectFile(file: WebTorrent.TorrentFile) {
    if (this.stopped) throw new Error("download is stopped");
    if (!this.files.has(file.path)) return;
    file.select();
    this.files.set(file.path, {
      selected: true,
      paused: false,
      streamed: this.files.get(file.path)?.streamed || false,
    });
  }

  deselectFile(file: WebTorrent.TorrentFile) {
    if (!this.files.has(file.path)) return;

    file.deselect();
    this.files.set(file.path, {
      selected: false,
      paused: this.files.get(file.path)?.paused || false,
      streamed: this.files.get(file.path)?.streamed || false,
    });
  }
  pauseFiles(torrent: WebTorrent.Torrent, files?: string[]) {
    const filesSet = files ? new Set(files) : this.files;
    torrent.files.forEach((f) => {
      if (filesSet.has(f.path) && this.files.has(f.path)) {
        f.deselect();
        console.log("deselected :", f.name);
        this.files.set(f.path, {
          paused: true,
          selected: this.files.get(f.path)?.selected || false,
          streamed: this.files.get(f.path)?.streamed || false,
        });
      }
    });
  }
  resume(torrent: WebTorrent.Torrent, files?: string[]) {
    const filesSet = files ? new Set(files) : this.files;
    torrent.files.forEach((f) => {
      if (filesSet.has(f.path) && this.files.get(f.path)?.selected) {
        f.select();
        console.log("selected :", f.name);

        this.files.set(f.path, {
          paused: false,
          selected: this.files.get(f.path)?.selected || false,
          streamed: this.files.get(f.path)?.streamed || false,
        });
      }
    });
    this.stopped = false;
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
      if (this.files.has(file.path)) {
        this.files.set(file.path, {
          paused: false,
          selected: this.files.get(file.path)?.selected || false,
          streamed: false,
        });
      }
      cleanup(this);
    });
    if (this.files.has(file.path)) {
      this.files.set(file.path, {
        paused: false,
        selected: this.files.get(file.path)?.selected || false,
        streamed: true,
      });
    }
    this.once("stop", () => {
      //@ts-ignore
      stream.destroy();
      if (!this.files.get(file.path)?.selected) file.deselect();
      stream.removeAllListeners();
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
  removeStreamsWithHash(hash: string) {
    this.openStreams.forEach((s, id) => {
      if (s.infoHash.toLowerCase() === hash.toLowerCase()) {
        this.openStreams.delete(id);
      }
    });
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
