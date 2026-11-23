/* Stored ZIP entries, with UTF-8 filenames and CRC-32 per entry. */
globalThis.packZip = function packZip(files) {
  const encoder = new TextEncoder();
  const dataParts = [], directory = [];
  let offset = 0, directorySize = 0;
  function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  }
  function header(length, signature) {
    const view = new DataView(new ArrayBuffer(length));
    view.setUint32(0, signature, true);
    return view;
  }
  for (const [path, value] of Object.entries(files)) {
    const name = encoder.encode(path), data = typeof value === "string" ? encoder.encode(value) : value;
    const crc = crc32(data);
    const local = header(30, 0x04034b50), central = header(46, 0x02014b50);
    central.setUint16(4, 20, true);
    for (const [view, shift] of [[local, 0], [central, 2]]) {
      view.setUint16(4 + shift, 20, true);
      view.setUint16(6 + shift, 0x800, true);
      view.setUint16(12 + shift, 33, true);
      view.setUint32(14 + shift, crc, true);
      view.setUint32(18 + shift, data.length, true);
      view.setUint32(22 + shift, data.length, true);
      view.setUint16(26 + shift, name.length, true);
    }
    central.setUint32(42, offset, true);
    dataParts.push(local.buffer, name, data);
    directory.push(central.buffer, name);
    offset += 30 + name.length + data.length;
    directorySize += 46 + name.length;
  }
  const end = header(22, 0x06054b50);
  end.setUint16(8, directory.length / 2, true);
  end.setUint16(10, directory.length / 2, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...dataParts, ...directory, end.buffer], {type:"application/zip"});
};

/* Reads a ZIP (stored or deflate entries) into {path: Uint8Array}.
   Deflate uses the browser's DecompressionStream. */
globalThis.unpackZip = async function unpackZip(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("O arquivo não é um ZIP válido.");
  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true);
  const decoder = new TextDecoder(), files = {};
  for (let n = 0; n < count; n++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error("O índice do ZIP está corrompido.");
    const method = view.getUint16(pos + 10, true), compressed = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true), extra = view.getUint16(pos + 30, true), comment = view.getUint16(pos + 32, true);
    const local = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength)).replace(/\\/g, "/");
    pos += 46 + nameLength + extra + comment;
    if (name.endsWith("/")) continue;
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error("Uma entrada do ZIP está corrompida.");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + compressed);
    if (method === 0) files[name] = raw.slice();
    else if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      files[name] = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new Error("O ZIP usa uma compressão que o navegador não lê (" + name + ").");
  }
  return files;
};
