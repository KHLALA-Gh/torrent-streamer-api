import EventEmitter from "events";
import { Cache, State as StateProps, StreamState } from "../types/config";
import { Streamer, StreamsState } from "./streamer.js";

interface StateEvents {
  stream: [stream: StreamState];
  removeStream: [];
}

export class State extends EventEmitter<StateEvents> implements StateProps {
  openStreams: StreamsState;
  cache: Cache;
  streamer: Streamer;
  constructor(streamer: Streamer, cache: Cache) {
    super();
    this.openStreams = new StreamsState();
    this.cache = cache;
    this.streamer = streamer;
  }
  setStream(id: string, s: StreamState) {
    this.openStreams.setStream(id, s);
    this.emit("stream", s);
  }
  removeStream(id: string) {
    this.openStreams.removeStream(id);
    this.emit("removeStream");
  }
}
