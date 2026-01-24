import { DownloadFile, DownloadStatus } from "../lib/streamer";

export interface TorrentFileMetaData {
  name: string;
  path: string;
  size: number;
  streamUrl?: string;
  /**
   * File path encoded to base 64
   */
  path64: string;
}

export interface TorrentFile {
  name: string;
  path: string;
  size: number;
  torrentHash: string;
  progress?: number;
  downloaded?: boolean;
  streamUrl?: string;
}

export interface Stream {
  id: string;
  name: string;
  path: string;
  size: number;
  hash: string;
  preStream?: boolean;
}
export interface File extends DownloadFile {
  path: string;
  progress: number;
  size: number;
  downloaded: number;
}
export interface TorrentDownload {
  name: string;
  infoHash: string;
  files: File[];
  path: string;
  progress: number;
  upSpeed: number;
  downSpeed: number;
  paused: boolean;
  downloadSize: number;
  totalSize: number;
  downloaded: number;
  stopped: boolean;
  status: DownloadStatus;
  idling: boolean;
}
