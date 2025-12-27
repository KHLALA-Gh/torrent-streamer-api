import prettyBytes from "pretty-bytes";
import { State } from "./state.js";

type LoggerMode = "streams" | "torrents" | "files";

export class Logger {
  private mode: LoggerMode;
  state: State;
  constructor(state: State, mode?: LoggerMode) {
    this.mode = "streams";
    this.state = state;

    this.setMode(mode || "streams");
  }
  getMode(): LoggerMode {
    return this.mode;
  }
  setMode(m: LoggerMode) {
    this.mode = m;
    switch (m) {
      case "files":
        this.logFiles();
      case "torrents":
        this.logTorrents();
      case "streams":
        this.logStreams();
    }
  }
  logStreams() {
    if (this.mode === "streams") {
      console.clear();
      console.log("Streams : ");
      console.table(this.state.openStreams.ipOpenStreamsTable());
      this.logLoggerInfo();
    }
  }
  logTorrents() {
    if (this.mode === "torrents") {
      console.clear();
      console.log("Torrents : ");
      console.table(
        this.state.streamer.torrents.map((t) => {
          return {
            name: t.name,
            infoHash: t.infoHash,
            files: t.files.length,
          };
        })
      );
      this.logLoggerInfo();
    }
  }
  logFiles() {
    if (this.mode === "files") {
      console.clear();
      console.log("Files : ");
      console.table(
        Array.from(this.state.streamer.downloads.values()).map((f) => {
          return {
            name: f.file?.name,
            size: prettyBytes(f.file?.length || 0),
            progress: `${((f.file?.progress || 0) * 100).toFixed(2)}%`,
          };
        })
      );
      this.logLoggerInfo();
    }
  }
  logLoggerInfo() {
    console.log(`Logger keys : 
- s : show streams
- t : show torrents
- f : show files`);
  }
  log() {
    this.state.on("stream", () => {
      this.logStreams();
    });
    this.state.on("removeStream", () => {
      this.logStreams();
    });
    this.state.streamer.on("torrent", () => {
      this.logTorrents();
    });
    //@ts-ignore
    this.state.streamer.on("file", () => {
      this.logFiles();
    });
  }
}
