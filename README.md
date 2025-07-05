<div align="center">

<img src="./Logo.png" width="176px" align="center"/>

<h1 align="center">Torrent-Streamer-Api</h1>
</div>

## What can it do ?

The Torrent Streamer API is a RESTful API built with Node.js and the Express library. It allows you to search for torrents and stream videos via the HTTP protocol.

## How to run the API

### Requirements :

- NodeJS >= v22
- express >= v5 `npm i express@latest`
- body-parser >= v2 `npm i body-parser@latest`

install the library

```shell
npm i torrent-streamer-api
```

## How to use it ?

```js
import express from "express";
import TorrentStreamer from "torrent-streamer-api";
import bodyParser from "body-parser";

const app = express();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

app.use(TorrentStreamer());

app.listen(8080, () => {});
```

### Search for torrents

**endpoint : GET /api/search**

queries :

- query : the search query
- limit : the limit of torrents (if not set it will be 20)

**example :**
request url : http://localhost:8080/api/search?query=ubuntu&limit=3

**response** :
The server will send torrents one by one (Server-Sent Events).

```
data: {"magnetURI":"magnet:?xt=urn:btih:D0F23C109D8662A3FE9338F75839AF8D57E5D4A9&dn=Ubuntu+MATE+16.04.2+%5BMATE%5D%5Barmhf%5D%5Bimg.xz%5D%5BUzerus%5D&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=http%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Fopentracker.i2p.rocks%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Fcoppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.zer0day.to%3A1337%2Fannounce","infoHash":"D0F23C109D8662A3FE9338F75839AF8D57E5D4A9","torrentDownload":"http://itorrents.org/torrent/D0F23C109D8662A3FE9338F75839AF8D57E5D4A9.torrent","name":"Ubuntu MATE 16.04.2 [MATE][armhf][img.xz][Uzerus]","url":"https://1337x.to/torrent/2099267/Ubuntu-MATE-16-04-2-MATE-armhf-img-xz-Uzerus/","seeders":260,"leechers":2,"provider":"1337x","size":"1.1 GB260","uploader":"Uzerus"}

data: {"magnetURI":"magnet:?xt=urn:btih:272A29567ED08AB80B0E98C59F587B7F83C2E344&dn=SkillShare+%7C+VPS+Mastery%3A+Build+Your+Own+PHP+Web+Server+With+Ubuntu+%5BFCO%5D&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&tr=udp%3A%2F%2Ftracker.tiny-vps.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fp4p.arenabg.com%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.bitsearch.to%3A1337%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fexplodie.org%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2780%2Fannounce&tr=udp%3A%2F%2Ffe.dealclub.de%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2900%2Fannounce&tr=udp%3A%2F%2F9.rarbg.me%3A2720%2Fannounce&tr=udp%3A%2F%2Fipv4.tracker.harry.lu%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=http%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Fopentracker.i2p.rocks%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Fcoppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.zer0day.to%3A1337%2Fannounce","infoHash":"272A29567ED08AB80B0E98C59F587B7F83C2E344","torrentDownload":"http://itorrents.org/torrent/272A29567ED08AB80B0E98C59F587B7F83C2E344.torrent","name":"SkillShare | VPS Mastery: Build Your Own PHP Web Server With Ubuntu [FCO]","url":"https://1337x.to/torrent/5471519/SkillShare-VPS-Mastery-Build-Your-Own-PHP-Web-Server-With-Ubuntu-FCO/","seeders":24,"leechers":5,"provider":"1337x","size":"3.1 GB24","uploader":""}

data: {"magnetURI":"magnet:?xt=urn:btih:9F9165D9A281A9B8E782CD5176BBCC8256FD1871&dn=Ubuntu+16.04.1+LTS+Desktop+64-bit&tr=http%3A%2F%2Ftorrent.ubuntu.com%3A6969%2Fannounce&tr=http%3A%2F%2Fipv6.torrent.ubuntu.com%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=http%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Fopentracker.i2p.rocks%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Fcoppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.zer0day.to%3A1337%2Fannounce","infoHash":"9F9165D9A281A9B8E782CD5176BBCC8256FD1871","torrentDownload":"http://itorrents.org/torrent/9F9165D9A281A9B8E782CD5176BBCC8256FD1871.torrent","name":"Ubuntu 16.04.1 LTS Desktop 64-bit","url":"https://1337x.to/torrent/1699436/Ubuntu-16-04-1-LTS-Desktop-64-bit/","seeders":55,"leechers":2,"provider":"1337x","size":"1.4 GB55","uploader":""}

event: close
data: Closing connection
```

To receive search results, you must use `EventSource` in javascript :

```javascript
const source = new EventSource(
  "http://localhost:8080/api/search?query=ubuntu&limit=3"
);

source.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log("Received JSON:", data);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
  }
};

source.onerror = (error) => {
  console.error("EventSource failed:", error);
};

source.addEventListener("close", (event) => {
  console.log("Server sent close event:", event.data);
  source.close();
});
```

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

### Download or stream Torrent Files

You can also choose a file to download from your torrent.

**endpoint : GET /api/torrents/:hash/files/:path_64**

> Note : To avoid having a "/" character of the file path in the request URL, you must use the base64 version of the file path.

**example :**

The file path in the torrent that we want to download is `folder/file.txt`, so the base64 version will be `Zm9sZGVyL2ZpbGUudHh0`.

request url : http://localhost:8080/api/torrents/any_hash/files/Zm9sZGVyL2ZpbGUudHh0

**response** :
The server will stream the file for you.

## Streams

### Create a PreStream

The server will start downloading the file before any stream requests.

**endpoint : POST /api/streams**

- Request body :

```json
{
  "hash": "<Torrent Info Hash>",
  "filePath": "<File Path>"
}
```

- Server response

```json
{
  "id": "<Stream id>",
  "name": "<File Name>",
  "path": "<File Path>",
  "size": 381942311 /* File Size */,
  "torrentHash": "<Info Hash>",
  "progress": 0 /* Download progress (0 to 1) */,
  "streamUrl": "http://domain/api/streams/<Stream id>" /* Stream URL */
}
```

### Download PreStream

Download or stream the file.

**endpoint : GET /api/streams/:stream_id**

- Response : Server will stream the file.

### Get Streams

Get all direct streams and preStreams.

**endpoint : GET /api/streams**

- Server Response :

```json
[
  {
    "id": "<Stream id>",
    "name": "<File Name>",
    "path": "<File Path>",
    "size": 381942311 /* File Size */,
    "torrentHash": "<Info Hash>",
    "progress": 0 /* Download progress (0 to 1) */,
    "streamUrl": "http://domain/api/streams/<Stream id>" /* Stream URL */
  },
  {
    "id": "<Stream id>",
    "name": "<File Name>",
    "path": "<File Path>",
    "size": 4894515 /* File Size */,
    "torrentHash": "<Info Hash>",
    "progress": 0.325868 /* Download progress (0 to 1) */,
    "streamUrl": "http://domain/api/streams/<Stream id>" /* Stream URL */
  }
]
```

### Delete a stream

Stops a stream.

**endpoint DEL /api/streams/:id**

- Response : server will stop downloading

## Term of use

**Please do not use this software with copyrighted or illegal content.**
