import child_process from "node:child_process";

export async function* jsonCmd(cmd, args, options) {
  const h = child_process.spawn(cmd, args, { ...options });
  const d = new TextDecoder();
  let buf = new Uint8Array(0);
  let currentPromise = Promise.withResolvers();
  let queue = [];

  const tryParse = (buffer) => {
    const json = d.decode(buffer);
    try {
      return JSON.parse(json);
    } catch (e) {
      return { parseError: e, input: json };
    }
  };
  const cutToFirstNewline = (...buffers) => {
    const nextBuf = Buffer.concat(buffers);
    const newline = nextBuf.indexOf(10);
    if (newline === -1) {
      return [undefined, nextBuf];
    }
    const nextStart = newline + 1;
    const nextLen = nextBuf.byteLength - nextStart;
    const line = new Uint8Array(nextStart);
    nextBuf.copy(line, 0, 0, nextStart);
    const buf = new Uint8Array(nextLen);
    nextBuf.copy(buf, 0, nextStart, nextBuf.byteLength);
    return [line, buf];
  }
  const queueChunk = (chunk) => {
    let line;
    [line, buf] = cutToFirstNewline(buf, chunk);
    do {
      if (line) {
        queue.push(tryParse(line));
        currentPromise.resolve();
        currentPromise = Promise.withResolvers();
      }
      [line, buf] = cutToFirstNewline(buf);
    } while (line !== undefined);
  };
  h.stdout.on('data', queueChunk);
  h.stderr.on('data', queueChunk);
  h.once('close', (status, signal) => {
    currentPromise.resolve();
  });
  do {
    await currentPromise.promise;
    while (queue.length) {
      yield queue.shift();
    }
  } while (h.exitCode === null)
  if (buf.byteLength) {
    yield tryParse(buf);
  }
}
