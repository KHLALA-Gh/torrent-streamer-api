import readline from "readline";

// Function type for key handlers
export type KeyFn = () => void | Promise<void>;

// Keys interface for constructor
export interface Keys {
  [key: string]: KeyFn;
}

export class KeyPress extends Map<string, KeyFn> {
  constructor(keys: Keys = {}) {
    super(Object.entries(keys));
  }

  /**  Convert a key object to string like "ctrl+shift+a" */
  private static getKeyId(key: readline.Key): string {
    const parts = [
      key.ctrl ? "ctrl" : null,
      key.shift ? "shift" : null,
      key.meta ? "meta" : null,
      key.name,
    ].filter(Boolean);
    return parts.join("+");
  }

  /**  Start listening for key presses*/
  start() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    process.stdin.on("keypress", async (_ch, key) => {
      if (!key) return;

      const keyId = KeyPress.getKeyId(key as readline.Key);
      if (this.has(keyId)) {
        const handler = this.get(keyId);
        if (handler) await handler();
      }

      // exit on Ctrl+C
      if (key.ctrl && key.name === "c") {
        process.exit();
      }
    });
  }

  bind(keyCombo: string, handler: KeyFn) {
    this.set(keyCombo, handler);
  }

  // Remove a key handler
  unbind(keyCombo: string) {
    this.delete(keyCombo);
  }
}
