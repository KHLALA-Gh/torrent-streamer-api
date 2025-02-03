export function encodeTo64(str: string) {
  return Buffer.from(str, "utf-8").toString("base64");
}

export function decodeToUTF8(str: string) {
  return Buffer.from(str, "base64").toString("utf-8");
}
