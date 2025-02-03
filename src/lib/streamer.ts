import { Response } from "express";
import Webtorrent from "webtorrent";

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

  stream(res: Response, range?: string) {
    let torrent = this.add(this.magnetURI, (torrent) => {
      const file = torrent.files.find((f) => f.name.endsWith(".mp4"));

      if (!file) {
        console.log("MP4 file not found for info hash : " + torrent.infoHash);
        res.status(404).json({
          error: "MP4 file not found for info hash : " + torrent.infoHash,
        });
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
    res.on("close", () => {
      torrent.destroy({}, (err) => {
        if (err) {
          console.log("error while destroying streamer : " + err.toString());
          return;
        }
        console.log("response closed : streamer destroyed");
      });
    });
    return torrent;
  }
  async streamFile(
    res: Response,
    path: string,
    range?: string,
    callback?: () => boolean
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
      if (callback && !callback()) {
        return;
      }
      if (!range) {
        const start = 0;
        const end = file.length - 1;
        const stream = file.createReadStream({ start, end });

        res.writeHead(200, {
          "Content-Length": file.length,
          "Content-Type": "application/octet-stream",
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
