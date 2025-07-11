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
  "DOWNLOAD_ID_NOTFOUND",
}

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

export class Streamer extends Webtorrent {
  public downloads: Map<string, FileDownload>;
  constructor() {
    super();
    this.downloads = new Map();
    this.on("error", (err) => {
      console.log(err);
    });
  }
  async getTorrent(
    hash: string,
    opts?: WebTorrent.TorrentOptions
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
        }
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
    callback?: (file: WebTorrent.TorrentFile) => boolean
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
    cleanup: (download: FileDownload) => void,
    range?: string
  ): Promise<FileDownload | undefined> {
    if (!path) {
      throw new StreamerErr(
        `${path} path is invalid`,
        StreamerErrCode.INVALID_PATH
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
      return;
    }
    let fileDownload = this.getDownloadByPathAndHash(hash, file.path);
    if (!fileDownload) {
      fileDownload = new FileDownload(randomUUID(), torrent, file);
      this.downloads.set(fileDownload.id, fileDownload);
      fileDownload.file?.select();
    }
    console.log("found : " + fileDownload.file?.name);
    if (res.headersSent) throw new Error("response already sent");
    let metadata = fileDownload.getStreamMetaData(range);
    res.writeHead(range ? 206 : 200, {
      "Content-Range": `bytes ${metadata.start}-${metadata.end}/${fileDownload.file?.length}`,
      "Accept-Ranges": "bytes",
      "Content-Length": metadata.chunkSize,
      "Content-Type": metadata.contentType,
      "Content-Disposition": `attachment; filename="${fileDownload.file?.name}"`,
    });
    fileDownload.stream(res, cleanup, range);

    return fileDownload;
  }
  async experimental_streamMKV(
    magnetURI: string,
    res: Response,
    path?: string,
    callback?: (file: FileDownload) => boolean
  ) {
    let torrent = await this.getTorrent(magnetURI);

    const file = torrent.files.find(
      (f) => path === f?.path || (!path && f.name.endsWith(".mkv"))
    );
    if (!file) {
      res.status(404).json({
        error: "mkv file not found",
      });
      return;
    }
    let fileDownload = new FileDownload(randomUUID(), torrent, file);
    if (typeof callback === "function") {
      let cont = callback(fileDownload);
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
    return fileDownload;
  }
  async download(
    id: string,
    hash: string,
    filePath: string,
    downloadPath: string,
    onDownload?: (fileDownload: FileDownload) => void
  ): Promise<FileDownload> {
    const fileDownload = new FileDownload(id);
    this.downloads.set(id, fileDownload);

    let torrent = await this.getTorrent(hash, { path: downloadPath });
    fileDownload.torrent = torrent;
    fileDownload.emit("torrent", torrent);

    console.log(`Downloading: ${torrent.name}`);

    torrent.on("done", () => {
      console.log("Torrent download finished!");
      fileDownload.emit("done");
      fileDownload.removeAllListeners();
      fileDownload.downloaded = true;
    });
    let found = false;
    torrent.files.forEach((file) => {
      if (file.path !== filePath) {
        return;
      }
      file.select();
      found = true;
      console.log(`Saving file: ${file.path}`);
      fileDownload.file = file;

      if (onDownload) {
        onDownload(fileDownload);
      }
      fileDownload.emit("file", torrent, file);
    });
    if (!found) {
      fileDownload.emit(
        "error",
        new StreamerErr(
          `${filePath} is not found in the torrent with info hash : ${torrent.infoHash}`,
          StreamerErrCode.FILE_NOTFOUND
        )
      );
      fileDownload.removeAllListeners();
      torrent.destroy();
    }
    torrent.on("error", (err) => {
      if (typeof err === "string") {
        fileDownload.emit("error", new Error(err));

        return;
      }
      fileDownload.emit("error", err);
      torrent.destroy();
    });

    return fileDownload;
  }
  async stopDownload(id: string) {
    let fileDownload = this.downloads.get(id);
    if (!fileDownload) {
      throw new StreamerErr(
        "download not found",
        StreamerErrCode.DOWNLOAD_ID_NOTFOUND
      );
    }
    fileDownload.file?.deselect();
  }
  getDownloads(): TorrentFile[] {
    let downloads = this.downloads.values().toArray();
    let files: TorrentFile[] = [];
    for (let d of downloads) {
      if (!d.file) continue;
      files.push({
        id: d.id,
        name: d.file.name,
        path: d.file.path,
        size: d.file.length,
        torrentHash: d.torrent?.infoHash || "",
        progress: d.downloaded ? 1 : d.file.progress,
        streamUrl: d.streamUrl,
      });
    }
    return files;
  }
  getDownloadByPathAndHash(
    hash: string,
    path: string
  ): FileDownload | undefined {
    let downloads = this.downloads.values().toArray();
    for (let d of downloads) {
      if (!d.file || !d.torrent) continue;
      if (
        d.file.path === path &&
        d.torrent.infoHash.toLowerCase() === hash.toLowerCase()
      ) {
        return d;
      }
    }
  }
  streamDownlaod(
    id: string,
    res: Response,
    range?: string
  ): NodeJS.ReadableStream {
    const download = this.downloads.get(id);
    if (!download || !download.file) {
      res.status(404).json({ err: "stream not found" });
      throw new StreamerErr(
        "pre stream id not found : " + id,
        StreamerErrCode.DOWNLOAD_ID_NOTFOUND
      );
    }
    let file = download.file;
    let fileExt = download.file.name.split(".").pop() || "";

    let contentTypeValue = contentType[fileExt] || "application/octet-stream";

    if (!range) {
      const start = 0;
      const end = file.length - 1;
      const stream = file.createReadStream({ start, end });

      res.writeHead(200, {
        "Content-Length": file.length,
        "Content-Type": contentTypeValue,
        "Content-Disposition": `attachment; filename="${file.name}"`,
      });

      stream.pipe(res);
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        res.end();
      });
      return stream;
    } else {
      const positions = range.replace(/bytes=/, "").split("-");
      const start = parseInt(positions[0], 10);
      const end = positions[1] ? parseInt(positions[1], 10) : file.length - 1;

      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${file.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentTypeValue,
        "Content-Disposition": `attachment; filename="${file.name}"`,
      });
      const stream = file.createReadStream({ start, end });
      stream.pipe(res);

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        res.end();
      });
      return stream;
    }
  }
  streamTo(download: FileDownload, res: Response, range?: string) {
    let file = download.file;
    if (!file)
      throw new StreamerErr(
        "file is not defined",
        StreamerErrCode.FILE_NOTFOUND
      );
    let fileExt = file.name.split(".").pop() || "";

    let contentTypeValue = contentType[fileExt] || "application/octet-stream";
    if (!range) {
      const start = 0;
      const end = file.length - 1;
      const stream = file.createReadStream({ start, end });

      res.writeHead(200, {
        "Content-Length": file.length,
        "Content-Type": contentTypeValue,
        "Content-Disposition": `attachment; filename="${file.name}"`,
      });
      download.emit("stream", stream);
      stream.pipe(res);
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        res.end();
      });
      return stream;
    } else {
      const positions = range.replace(/bytes=/, "").split("-");
      const start = parseInt(positions[0], 10);
      const end = positions[1] ? parseInt(positions[1], 10) : file.length - 1;

      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${file.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentTypeValue,
        "Content-Disposition": `attachment; filename="${file.name}"`,
      });
      const stream = file.createReadStream({ start, end });
      download.emit("stream", stream);

      stream.pipe(res);

      stream.on("error", (err) => {
        console.error(`Stream error when streaming "${file.name}" :`, err);
        res.end();
      });
      return stream;
    }
  }
  getTorrentFromDownloads(hash: string) {
    let files = this.downloads.values().toArray();
    for (let i = 0; i < files.length; i++) {
      if (
        files[i].torrent?.infoHash.toUpperCase() === hash.toLocaleUpperCase()
      ) {
        return files[i].torrent;
      }
    }
  }
}

interface FileDownloadEvents {
  file: [torrent: Webtorrent.Torrent, file: WebTorrent.TorrentFile];
  torrent: [torrent: Webtorrent.Torrent];
  stream: [stream: NodeJS.ReadableStream];
  error: [err: Error];
  done: [];
  destroy: [];
}

export class FileDownload extends EventEmitter<FileDownloadEvents> {
  file?: WebTorrent.TorrentFile;
  torrent?: WebTorrent.Torrent;
  id: string;
  streamUrl?: string;
  downloaded?: boolean;
  constructor(
    id: string,
    torrent?: WebTorrent.Torrent,
    file?: Webtorrent.TorrentFile
  ) {
    super();
    this.id = id;
    this.file = file;
    this.torrent = torrent;
  }
  getFile(): TorrentFile | void {
    if (!this.file || !this.torrent) return;
    return {
      id: this.id,
      name: this.file.name,
      path: this.file.path,
      size: this.file.length,
      torrentHash: this.torrent?.infoHash,
      progress: this.file.progress,
    };
  }
  stream(
    destination: any,
    cleanup: (download: FileDownload) => void,
    range?: string
  ): NodeJS.ReadableStream {
    if (!this.file) {
      throw new Error("file is not defined");
    }
    let stream;
    if (!range) {
      const start = 0;
      const end = this.file.length - 1;
      stream = this.file.createReadStream({ start, end });
    } else {
      const positions = range.replace(/bytes=/, "").split("-");
      const start = parseInt(positions[0], 10);
      const end = positions[1]
        ? parseInt(positions[1], 10)
        : this.file.length - 1;
      stream = this.file.createReadStream({ start, end });
    }
    pipeline(stream, destination, (err: any) => {
      if (err) {
        if (err.message.includes("prematurely")) {
          console.log(`Client closed stream early for "${this.file?.name}"`);
        } else {
          console.error(
            `Stream error when streaming "${this.file?.name}":`,
            err
          );
        }
      } else {
        console.log(`Stream finished successfully for "${this.file?.name}"`);
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
  softDestroy(durationToDestroy: number, cb?: () => void) {
    if (this.file) {
      try {
        this.file?.deselect();
      } catch (err) {
        console.log("failed to deselect the file : ", err);
      }
    }
    let destroyTorrentTimeout = setTimeout(() => {
      this.torrent?.destroy({}, (err) => {
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
  getStreamMetaData(range?: string): StreamMetadata {
    let fileExt = this.file?.name.split(".").pop() || "";
    let contentTypeValue = contentType[fileExt] || "application/octet-stream";
    if (range) {
      const positions = range.replace(/bytes=/, "").split("-");
      const start = parseInt(positions[0], 10);
      const end = positions[1]
        ? parseInt(positions[1], 10)
        : this.file?.length || 0 - 1;

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
        end: this.file?.length || 0 - 1,
        chunkSize: this.file?.length || 0,
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
        "\r" + spinner[i++ % spinner.length] + "fetching torrent : " + hash
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
}
