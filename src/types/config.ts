import { StreamsState } from "../lib/streamer";

export interface HandlerConfig {
  /**  Set a max duration to wait for the engine to be ready. (in ms)
   * If you want no time out set it to 0.
   */
  streamTimeOut: number;
  /**
   * Get files from torrent hash timeout (in ms)
   */
  torrentFilesTimeout: number;
  /**
   * Stream Limit per ip address
   */
  ipStreamLimit: number;
}

export interface StreamState {
  id: string;
  infoHash: string;
  filePath: string;
  size?: number;
}

export interface State {
  openStreams: StreamsState;
}
