---
"torrent-streamer-api": minor
---

**Add stream rate limit per ip address**

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
