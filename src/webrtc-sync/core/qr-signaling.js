const CHUNK_SIZE = 350; // QR menos denso: leitura mais confiável em telas de celular.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compress(bytes) {
  if (!('CompressionStream' in globalThis)) return { encoding: 'identity', bytes };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return { encoding: 'gzip', bytes: new Uint8Array(await new Response(stream).arrayBuffer()) };
}

async function decompress(bytes, encoding) {
  if (encoding === 'identity') return bytes;
  if (encoding !== 'gzip' || !('DecompressionStream' in globalThis)) {
    throw new Error('Este navegador não consegue descompactar o QR Code recebido.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function createQrSignalFrames(signal) {
  const raw = encoder.encode(JSON.stringify({
    version: 1,
    type: signal.type,
    sdp: signal.sdp,
  }));
  const packed = await compress(raw);
  const encoded = toBase64Url(packed.bytes);
  const transferId = crypto.randomUUID();
  const total = Math.ceil(encoded.length / CHUNK_SIZE);
  return Array.from({ length: total }, (_, index) => JSON.stringify({
    app: 'vue-webrtc-p2p',
    version: 1,
    transferId,
    index,
    total,
    encoding: packed.encoding,
    data: encoded.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  }));
}

export function createSignalAssembler() {
  let activeTransfer = null;

  return {
    reset() {
      activeTransfer = null;
    },

    async add(raw) {
      let frame;
      try {
        frame = JSON.parse(raw);
      } catch {
        throw new Error('QR Code não contém uma mensagem de pareamento válida.');
      }

      if (
        frame?.app !== 'vue-webrtc-p2p' ||
        frame.version !== 1 ||
        typeof frame.transferId !== 'string' ||
        !Number.isInteger(frame.index) ||
        !Number.isInteger(frame.total) ||
        frame.total < 1 ||
        frame.total > 100 ||
        frame.index < 0 ||
        frame.index >= frame.total ||
        typeof frame.data !== 'string'
      ) {
        throw new Error('Fragmento QR inválido ou incompatível.');
      }

      if (!activeTransfer || activeTransfer.transferId !== frame.transferId) {
        activeTransfer = {
          transferId: frame.transferId,
          total: frame.total,
          encoding: frame.encoding,
          parts: new Map(),
        };
      }

      if (activeTransfer.total !== frame.total || activeTransfer.encoding !== frame.encoding) {
        throw new Error('Os fragmentos recebidos pertencem a transferências incompatíveis.');
      }

      activeTransfer.parts.set(frame.index, frame.data);
      const received = activeTransfer.parts.size;

      if (received !== activeTransfer.total) {
        return { complete: false, received, total: activeTransfer.total };
      }

      const encoded = Array.from({ length: activeTransfer.total }, (_, i) => activeTransfer.parts.get(i)).join('');
      const bytes = await decompress(fromBase64Url(encoded), activeTransfer.encoding);
      const signal = JSON.parse(decoder.decode(bytes));

      if (signal.version !== 1 || !['offer', 'answer'].includes(signal.type) || typeof signal.sdp !== 'string') {
        throw new Error('Descrição WebRTC inválida.');
      }

      activeTransfer = null;
      return { complete: true, signal };
    },
  };
}
