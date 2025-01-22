import { Request, Response } from "express";
import Webtorrent from "webtorrent";

enum StreamerErrCode {
  "MP4FILE_NOTFOUND",
}

class StreamerErr extends Error {
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

  async stream(res: Response, range?: string) {
    this.add(this.magnetURI, (torrent) => {
      const file = torrent.files.find((f) => f.name.endsWith(".mp4"));
      if (!file) {
        throw new StreamerErr(
          "Mp4 file not found for infoHash : " + torrent.infoHash,
          StreamerErrCode.MP4FILE_NOTFOUND
        );
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
  }
}
