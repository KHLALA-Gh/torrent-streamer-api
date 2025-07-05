# torrent-streamer-api

## 2.0.0

### Major Changes

- Upgrade to 2.0

## 1.1.0

### Minor Changes

- f122778: **Add stream rate limit per ip address**

  ```javascript
  TorrentStreamerApi({
    // Max streams for an ip address
    ipStreamLimit: 5,
  });
  ```

  **Add path64 in the /api/stream query**

  ```
  GET /api/stream?magnet=<magnet>&path64=<file_path_base64>
  ```

  **Set video type in the `Content-Type` when downloading from /api/torrents/:hash/files/:path64**

  ```
    mp4: "video/mp4"
    webm: "video/webm"
    mkv: "video/x-matroska"
    avi: "video/x-msvideo"
    mov: "video/quicktime"
    mpg: "video/mpeg"
  ```

  **Add console logs of open streams**

  ```
  ┌─────────┬────────────────────┬─────────────┐
  │ (index) │ ip                 │ openStreams │
  ├─────────┼────────────────────┼─────────────┤
  │ 0       │ '::ffff:127.0.0.1' │ 0           │
  │ 1       │ '127.0.0.1'        │ 1           │
  └─────────┴────────────────────┴─────────────┘
  ```

## 1.0.0

### Major Changes

- 10c941e: Add inspect files from torrent feature and download a choosen file feature.

## 0.2.0

### Minor Changes

- 47bad43: Switch to WebTorrent instead of torrent-stream.

### Patch Changes

- eddf9dd: Remove types declarations from dependencies

## 0.1.1

### Patch Changes

- Fix stream issues

## 0.1.0

### Minor Changes

- Make npm lib
