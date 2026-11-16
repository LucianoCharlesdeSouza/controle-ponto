const CHUNK_BYTES = 12 * 1024;
const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024;
const LOW_BUFFER_LIMIT = 256 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function waitForLowBuffer(channel) {
  if (channel.bufferedAmount <= LOW_BUFFER_LIMIT) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado aguardando espaço no buffer de envio.'));
    }, 30000);

    const onLow = () => {
      cleanup();
      resolve();
    };

    const onClose = () => {
      cleanup();
      reject(new Error('Conexão fechada durante o envio.'));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      channel.removeEventListener('bufferedamountlow', onLow);
      channel.removeEventListener('close', onClose);
    };

    channel.addEventListener('bufferedamountlow', onLow, { once: true });
    channel.addEventListener('close', onClose, { once: true });
  });
}

function sendControl(channel, message) {
  if (channel.readyState !== 'open') throw new Error('O canal WebRTC não está conectado.');
  channel.send(JSON.stringify(message));
}

export function createDataChannelProtocol(channel, {
  maxPayloadBytes = MAX_PAYLOAD_BYTES,
  onData = () => {},
  onProgress = () => {},
  onState = () => {},
} = {}) {
  channel.binaryType = 'arraybuffer';
  channel.bufferedAmountLowThreshold = LOW_BUFFER_LIMIT;

  let pendingAck = null;
  let incoming = null;
  let disposed = false;

  const send = async (payload) => {
    if (disposed) throw new Error('Protocolo encerrado.');
    if (pendingAck) throw new Error('Já existe uma transferência aguardando confirmação.');

    const serialized = JSON.stringify(payload);
    const bytes = encoder.encode(serialized);

    if (bytes.byteLength > maxPayloadBytes) {
      throw new Error(`Dados excedem o limite de ${Math.round(maxPayloadBytes / 1024 / 1024)} MiB.`);
    }

    const transferId = crypto.randomUUID();
    const totalChunks = Math.ceil(bytes.length / CHUNK_BYTES);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');

    const ackPromise = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        if (pendingAck?.transferId === transferId) {
          pendingAck = null;
          reject(new Error('O outro aparelho não confirmou a transferência a tempo.'));
        }
      }, 120000);
      pendingAck = {
        transferId,
        resolve: (value) => { window.clearTimeout(timeout); pendingAck = null; resolve(value); },
        reject: (error) => { window.clearTimeout(timeout); pendingAck = null; reject(error); },
      };
    });

    sendControl(channel, {
      type: 'transfer-start',
      transferId,
      totalBytes: bytes.byteLength,
      totalChunks,
      hash,
    });

    for (let index = 0; index < totalChunks; index++) {
      await waitForLowBuffer(channel);
      const chunk = bytes.subarray(index * CHUNK_BYTES, Math.min((index + 1) * CHUNK_BYTES, bytes.length));
      sendControl(channel, {
        type: 'transfer-chunk',
        transferId,
        index,
        data: bytesToBase64(chunk),
      });
      onProgress({ direction: 'send', transferId, sent: index + 1, total: totalChunks });
    }

    sendControl(channel, { type: 'transfer-end', transferId });
    return ackPromise;
  };

  const handleMessage = async (event) => {
    if (disposed) return;

    let message;
    try {
      message = JSON.parse(typeof event.data === 'string' ? event.data : decoder.decode(event.data));
    } catch {
      onState({ type: 'error', message: 'Mensagem recebida não é JSON válido.' });
      return;
    }

    if (message.type === 'transfer-ack' || message.type === 'transfer-error') {
      if (pendingAck?.transferId === message.transferId) {
        if (message.type === 'transfer-ack') pendingAck.resolve({ transferId: message.transferId });
        else pendingAck.reject(new Error(message.message || 'Falha ao processar os dados no aparelho remoto.'));
      }
      return;
    }

    if (message.type === 'transfer-start') {
      if (
        typeof message.transferId !== 'string' ||
        !Number.isInteger(message.totalBytes) ||
        message.totalBytes < 0 ||
        message.totalBytes > maxPayloadBytes ||
        !Number.isInteger(message.totalChunks) ||
        message.totalChunks < 1 ||
        message.totalChunks > 10000
      ) {
        sendControl(channel, { type: 'transfer-error', transferId: message.transferId, message: 'Metadados de transferência inválidos.' });
        return;
      }

      incoming = {
        transferId: message.transferId,
        totalBytes: message.totalBytes,
        totalChunks: message.totalChunks,
        hash: message.hash,
        chunks: new Array(message.totalChunks),
        received: 0,
      };
      onProgress({ direction: 'receive', received: 0, total: message.totalChunks });
      return;
    }

    if (message.type === 'transfer-chunk') {
      if (!incoming || message.transferId !== incoming.transferId || !Number.isInteger(message.index)) return;
      if (message.index < 0 || message.index >= incoming.totalChunks || incoming.chunks[message.index]) return;

      const chunk = base64ToBytes(message.data);
      incoming.chunks[message.index] = chunk;
      incoming.received++;
      onProgress({ direction: 'receive', received: incoming.received, total: incoming.totalChunks });
      return;
    }

    if (message.type === 'transfer-end') {
      if (!incoming || message.transferId !== incoming.transferId) return;
      const current = incoming;
      incoming = null;

      try {
        if (current.received !== current.totalChunks) throw new Error('Transferência incompleta: faltam fragmentos.');
        const size = current.chunks.reduce((sum, part) => sum + part.byteLength, 0);
        if (size !== current.totalBytes) throw new Error('Tamanho recebido não corresponde ao declarado.');

        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of current.chunks) {
          bytes.set(part, offset);
          offset += part.byteLength;
        }

        const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
        const hash = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
        if (hash !== current.hash) throw new Error('Falha na verificação de integridade SHA-256.');

        const payload = JSON.parse(decoder.decode(bytes));
        await onData(payload, { transferId: current.transferId });
        sendControl(channel, { type: 'transfer-ack', transferId: current.transferId });
        onState({ type: 'received', transferId: current.transferId });
      } catch (error) {
        sendControl(channel, {
          type: 'transfer-error',
          transferId: current.transferId,
          message: error instanceof Error ? error.message : 'Erro ao processar transferência.',
        });
      }
    }
  };

  channel.addEventListener('message', handleMessage);
  channel.addEventListener('open', () => onState({ type: 'open' }));
  channel.addEventListener('close', () => {
    if (pendingAck) pendingAck.reject(new Error('Conexão encerrada.'));
    onState({ type: 'closed' });
  });
  channel.addEventListener('error', () => onState({ type: 'error', message: 'Erro no canal WebRTC.' }));

  return {
    send,
    close() {
      disposed = true;
      if (pendingAck) pendingAck.reject(new Error('Protocolo encerrado.'));
      channel.removeEventListener('message', handleMessage);
    },
  };
}
