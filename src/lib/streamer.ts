import { Response } from "express";
import WebTorrent from "webtorrent";
import Webtorrent from "webtorrent";
import { StreamState } from "../types/config";

export enum StreamerErrCode {
  "MP4FILE_NOTFOUND",
  "INVALID_PATH",
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
      if (!range) {
        const start = 0;
        const end = file.length - 1;
        const stream = file.createReadStream({ start, end });

        res.writeHead(200, {
          "Content-Length": file.length,
          "Content-Type": "application/octet-stream",
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
          "Content-Type": "application/octet-stream",
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
}

export class StreamsState {
  public openStreams: Map<string, StreamState[]>;
  constructor() {
    this.openStreams = new Map<string, StreamState[]>();
  }
  getStreamCount(ip: string): number {
    let opS = this.openStreams.get(ip);
    if (opS) {
      return opS.length;
    }
    return 0;
  }
  setStream(ip: string, streamInfo: StreamState) {
    let opS = this.openStreams.get(ip);

    if (opS) {
      this.openStreams.set(ip, [...opS, streamInfo]);
    } else {
      this.openStreams.set(ip, [streamInfo]);
    }
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
}
