import { Streamer, StreamsState } from "../lib/streamer";

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
  /**
   * The number of concurrent website page scraping tasks per query.
   * The higher the number is, the faster the search.
   * If the number is too high you can get blocked from the search sites.
   */
  searchConcurrency: number;
  /**
   * The number of concurrent search queries.
   * If too many queries are running in the same time torrent sites may block
   * the requests.
   */
  queryConcurrency: number;
  /**
   * Default search max torrents
   */
  defaultSearchLimit: number;
  /**
   * Max search torrent limit
   */
  maxSearchLimit: number;
  /**
   * choose search limit from request searchParams.
   * If set to false the limit will be fixed and take the **defaultSearchLimit** value.
   */
  chooseSearchLimit: boolean;
  enableExperimentalMKVStream: boolean;
}

export interface StreamState {
  ip: string;
  infoHash: string;
  preStream?: boolean;
}

export interface State {
  openStreams: StreamsState;
  cache: Cache;
  streamer: Streamer;
}

export interface Cache {
  dirPath: string;
}

export const defaultConf: HandlerConfig = {
  streamTimeOut: 20 * 1000,
  torrentFilesTimeout: 20 * 1000,
  ipStreamLimit: 5,
  searchConcurrency: 5,
  queryConcurrency: 5,
  defaultSearchLimit: 20,
  maxSearchLimit: 100,
  chooseSearchLimit: true,
  enableExperimentalMKVStream: false,
};
