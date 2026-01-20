import prettyBytes from "pretty-bytes";
import { State } from "./state.js";
import path from "path";

type LoggerMode = "stream" | "torrent" | "file";

export class Logger {
  private mode: LoggerMode;
  state: State;
  interval?: NodeJS.Timeout;
  cb = () => {
    this.log();
  };
  constructor(state: State, mode?: LoggerMode) {
    this.mode = "stream";
    this.state = state;

    this.setMode(mode || "stream");
  }
  getMode(): LoggerMode {
    return this.mode;
  }
  setMode(m: LoggerMode) {
    this.mode = m;
    this.stop();
    this.start();
  }
  stop() {
    this.state.removeListener("removeStream", this.cb);
    this.state.removeListener("stream", this.cb);
    this.state.streamer?.removeListener("torrent", this.cb);
    this.state.streamer?.removeListener("file", this.cb);
    if (this.interval) clearInterval(this.interval);
  }
  logStreams() {
    this.clear();

    console.log("Streams : ");
    console.table(this.state.openStreams?.ipOpenStreamsTable());
  }
  logTorrents() {
    this.clear();

    console.log("Torrents : ");
    console.table(
      this.state.streamer?.torrents.map((t) => {
        return {
          name: t.name,
          infoHash: t.infoHash,
          files: t.files.length,
        };
      }),
    );
  }
  logFiles() {
    if (!this.state.streamer) return;
    this.clear();
    console.log("Files : ");
    const files: any[] = [];
    this.state.streamer.downloads.values().forEach(async (d, i) => {
      let t = await this.state.streamer.get(d.infoHash);
      if (!t) return;
      t.files.forEach((f) => {
        if (!d.selectedFiles.has(f.path)) return;

        files.push({
          name: f.name,
          size: prettyBytes(f.length),
          progress: `${(f.progress * 100).toFixed(2)}%`,
        });
      });
      if (i === this.state.streamer.downloads.size - 1) {
        console.table(files);
      }
    });
  }
  logTask(text: string) {
    this.clear();
    this.log(true);
    const spinner = ["|", "/", "-", "\\"];
    let i = 0;

    const interval = setInterval(() => {
      process.stdout.write("\r" + spinner[i++ % spinner.length] + text);
    }, 100);
    return (text: string) => {
      clearInterval(interval);
      if (text) {
        process.stdout.write(`\r${text}\n`);
      }
      setTimeout(() => {
        this.clear();
        this.log();
      }, 5000);
    };
  }
  logLoggerInfo() {
    console.log(`Logger keys : 
- s : show streams
- t : show torrents
- f : show files`);
  }
  clear() {
    console.clear();
  }
  log(withoutLoggerInfo?: boolean) {
    switch (this.mode) {
      case "file":
        this.logFiles();
        break;
      case "torrent":
        this.logTorrents();
        break;

      case "stream":
        this.logStreams();
        break;
    }
    if (!withoutLoggerInfo) this.logLoggerInfo();
  }
  start() {
    this.log();
    if (this.mode === "stream") {
      this.state.on("stream", this.cb);
      this.state.on("removeStream", this.cb);
    } else if (this.mode === "file") {
      //@ts-ignore
      this.interval = setInterval(this.cb, 2000);
    } else {
      this.state.streamer?.on("torrent", this.cb);
    }
  }
}
