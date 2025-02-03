<h1 align="center">Torrent-Streamer-Api</h1>

## What can it do ?

The Torrent Streamer API is a RESTful API built with Node.js and the Express library. It allows you to search for torrents and stream videos via the HTTP protocol.

## How to run the API

install the library

```shell
npm i torrent-streamer-api
```

## How to use it ?

```js
import express from "express";
import TorrentStreamerApi from "torrent-streamer-api";

const app = express();
const PORT = 8080;

const router = TorrentStreamerApi({});

app.use(router);

let server = app.listen(PORT, () => {
  console.log(`express server is listening on port ${PORT}`);
});
```

### Search for torrents

**endpoint : GET /api/search**

queries :

- query : the search query
- category : related category
- providers : torrent providers (if not set it will be all public providers)
- limit : the limit of torrents (if not set it will be 20)

**example :**
request url : http://localhost:8080/api/search?query=any_search_query&limit=3

**response** :

```json
[
  {
    "title": "<Title>",
    "time": "Sep. 12th '19",
    "seeds": 24989,
    "peers": 9792,
    "size": "2.0 GB",
    "desc": "<Description Link>",
    "provider": "<provider>",
    "magnetURI": "magnet:?xt=urn:btih:<rest_of_uri>"
  },
  {
    "title": "<Title>",
    "time": "Sep. 12th '19",
    "seeds": 14002,
    "peers": 6486,
    "size": "1.1 GB",
    "desc": "<Description Link>",
    "provider": "<provider>",
    "magnetURI": "magnet:?xt=urn:btih:<rest_of_uri>"
  },
  {
    "title": "<Title>",
    "time": "Feb. 20th '19",
    "seeds": 12974,
    "peers": 3163,
    "size": "1.9 GB",
    "desc": "<Description Link>",
    "provider": "<provider>",
    "magnetURI": "magnet:?xt=urn:btih:<rest_of>"
  }
]
```

### How to stream

Get the magnet URI from the search response and use it to stream the video. The server will look for an mp4 file, the first file found will be streamed.

**endpoint : GET /api/stream**

queries :

- magnet : magnet URI

**example :**

request url : http://localhost:8080/api/stream?magnet=magnet:?xt=urn:btih:rest_of_uri

**response :**
the server will stream the mp4 video.

### Inspect Torrent Files

You can inspect torrent files using the info hash.

**endpoint : GET /api/torrents/:hash/files**

**example :**

request url : http://localhost:8080/api/torrents/any_hash/files

**response** :

```json
[
  {
    "name": "video.mkv",
    "path": "folder/video.mkv",
    "size": 1264172729,
    "path64": "Zm9sZGVyL3ZpZGVvLm1rdg=="
  },
  {
    "name": "image.png",
    "path": "folder/image.png",
    "size": 1264172,
    "path64": "Zm9sZGVyL2ltYWdlLnBuZw=="
  },
  {
    "name": "file.txt",
    "path": "folder/file.txt",
    "size": 1264,
    "path64": "Zm9sZGVyL2ZpbGUudHh0"
  }
]
```

> Note : path64 is the path of the file encoded in base64.

### Download Torrent Files

You can also choose a file to download from your torrent.

**endpoint : GET /api/torrents/:hash/files/:path_64**

> Note : To avoid having a "/" character of the file path in the request URL, you must use the base64 version of the file path.

**example :**

The file path in the torrent that we want to download is `folder/file.txt`, so the base64 version will be `Zm9sZGVyL2ZpbGUudHh0`.

request url : http://localhost:8080/api/torrents/any_hash/files/Zm9sZGVyL2ZpbGUudHh0

**response** :
The server will stream the file for you.

## Term of use

**Please do not use this software with copyrighted or illegal content.**
