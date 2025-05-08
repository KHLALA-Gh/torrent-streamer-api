import { Response } from "express";
import WebTorrent from "webtorrent";
import Webtorrent from "webtorrent";
import { StreamState } from "../types/config";
import ffmpeg from "fluent-ffmpeg";
import { Torrent } from "../types/search";
import { Stream, TorrentFile, TorrentMetaData } from "../types/torrent";
export enum StreamerErrCode {
  "MP4FILE_NOTFOUND",
  "INVALID_PATH",
  "FILE_NOTFOUND",
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
  magnetURI: string;
  constructor(magnetURI: string) {
    super();
    this.magnetURI = magnetURI;
    this.on("error", (err) => {
      console.log(err);
    });
  }
  stream(
    res: Response,
    filePath?: string,
    range?: string,
    callback?: (file: WebTorrent.TorrentFile) => boolean
  ) {
    let torrent = this.add(this.magnetURI, (torrent) => {
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
    res: Response,
    path: string,
    range?: string,
    callback?: (file: WebTorrent.TorrentFile) => boolean
  ) {
    if (!path) {
      throw new StreamerErr(
        `${path} path is invalid`,
        StreamerErrCode.INVALID_PATH
      );
    }
    let torrent = this.add(this.magnetURI, (torrent) => {
      const file = torrent.files.find((f) => f.path === path);

      if (!file) {
        console.log(`file not found for info hash : ${torrent.infoHash}`);
        res.status(404).json({
          error: "file not found for info hash : " + torrent.infoHash,
        });
        return;
      }
      if (callback && !callback(file)) {
        return;
      }
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
          "Content-Type": contentTypeValue,
          "Content-Disposition": `attachment; filename="${file.name}"`,
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
  async experimental_streamMVK(
    res: Response,
    path?: string,
    callback?: (file: WebTorrent.TorrentFile) => boolean
  ) {
    let torrent = this.add(this.magnetURI, (torrent) => {
      console.log(this.magnetURI);

      const file = torrent.files.find(
        (f) => path === f?.path || (!path && f.name.endsWith(".mkv"))
      );
      if (!file) {
        res.status(404).json({
          error: "mkv file not found",
        });
        return;
      }
      if (typeof callback === "function") {
        let cont = callback(file);
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
    });
    return torrent;
  }
  async download(
    filePath: string,
    downloadPath: string,
    callback?: (
      torrent: WebTorrent.Torrent,
      file?: WebTorrent.TorrentFile,
      err?: Error
    ) => void
  ) {
    this.add(this.magnetURI, { path: downloadPath }, (torrent) => {
      console.log(`Downloading: ${torrent.name}`);

      torrent.on("done", () => {
        console.log("Torrent download finished!");
        this.destroy();
      });
      let found = false;
      torrent.files.forEach((file) => {
        if (file.path !== filePath) {
          file.deselect();
          return;
        }
        if (typeof callback === "function") {
          callback(torrent, file);
        }
        found = true;
        console.log(`Saving file: ${file.path}`);
      });
      if (!found && typeof callback === "function") {
        callback(
          torrent,
          undefined,
          new StreamerErr(
            `${filePath} is not found in the torrent with info hash : ${torrent.infoHash}`,
            StreamerErrCode.FILE_NOTFOUND
          )
        );
      }
    });
  }
}
export class StreamsState {
  public openStreams: Map<string, StreamState[]>;
  protected files: Map<string, TorrentFile>;
  constructor() {
    this.openStreams = new Map<string, StreamState[]>();
    this.files = new Map<string, TorrentFile>();
  }
  getStreamCount(ip: string): number {
    let opS = this.openStreams.get(ip);
    if (opS) {
      return opS.length;
    }
    return 0;
  }
  setStream(ip: string, streamInfo: Stream) {
    let opS = this.openStreams.get(ip);

    if (opS) {
      this.openStreams.set(ip, [
        ...opS,
        {
          id: streamInfo.id,
          infoHash: streamInfo.hash,
          preStream: streamInfo.preStream,
        },
      ]);
    } else {
      this.openStreams.set(ip, [
        {
          id: streamInfo.id,
          infoHash: streamInfo.hash,
          preStream: streamInfo.preStream,
        },
      ]);
    }
    this.files.set(streamInfo.id, {
      id: streamInfo.id,
      size: streamInfo.size,
      name: streamInfo.name,
      path: streamInfo.path,
      torrentHash: streamInfo.hash,
    });
  }
  ipOpenStreamsTable(): { ip: string; openStreams: number }[] {
    let table: { ip: string; openStreams: number }[] = [];
    this.openStreams.forEach((v, k) => {
      table.push({
        ip: k,
        openStreams: v.length,
      });
    });
    return table;
  }
  removeStream(ip: string, id: string) {
    let opS = this.openStreams.get(ip);
    if (opS) {
      opS = opS.filter((v) => v.id !== id);
      this.openStreams.set(ip, opS);
    }
  }
  getFile(id: string): TorrentFile | undefined {
    return this.files.get(id);
  }
  getFileByPathAndHash(hash: string, path: string): TorrentFile | undefined {
    let files = this.files.values().toArray();
    let file: TorrentFile | undefined;
    for (let f of files) {
      if (f.path === path && f.torrentHash === hash) {
        file = f;
      }
    }
    return file;
  }
}
