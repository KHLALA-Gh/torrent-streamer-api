import EventEmitter from "events";
import {
  Cache,
  HandlerConfig,
  State as StateProps,
  StreamState,
} from "../types/config";
import { Streamer, StreamsState } from "./streamer.js";
import { Logger } from "./logger.js";
import { KeyPress } from "./keypress.js";

interface StateEvents {
  stream: [stream: StreamState];
  removeStream: [];
}

export class State extends EventEmitter<StateEvents> implements StateProps {
  destroyed?: boolean;
  openStreams: StreamsState | null;
  cache: Cache | null;
  streamer: Streamer;
  logger?: Logger | null;
  config: HandlerConfig;
  keyPress?: KeyPress | null;
  constructor(streamer: Streamer, config: HandlerConfig, cache: Cache) {
    super();
    this.openStreams = new StreamsState();
    this.cache = cache;
    this.streamer = streamer;
    if (config.allowLogs) {
      this.logger = new Logger(this);
      this.logger.start();
      this.keyPress = new KeyPress({
        t: () => {
          this.logger?.setMode("torrent");
        },
        s: () => {
          this.logger?.setMode("stream");
        },
        f: () => {
          this.logger?.setMode("file");
        },
      });
      this.keyPress.start();
    }
    this.config = config;
  }
  setStream(id: string, s: StreamState) {
    this.openStreams?.setStream(id, s);
    this.emit("stream", s);
  }
  removeStream(id: string) {
    this.openStreams?.removeStream(id);
    this.emit("removeStream");
  }
  /**
   * Clears the state
   * destroys the streamer, deletes the streams and stops the logger.
   */
  destroy(callback?: (err: string | Error) => void) {
    this.removeAllListeners();
    this.streamer?.destroyStreamer((err) => {
      if (callback) callback(err);
    });
    this.openStreams?.openStreams.clear();
    this.openStreams = null;
    this.keyPress?.stop();
    this.keyPress = null;
    this.logger?.clear();
    this.logger?.stop();
    this.logger = null;
    this.destroyed = true;
  }
}
