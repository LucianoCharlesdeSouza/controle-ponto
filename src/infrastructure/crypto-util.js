
/**
 * src/infrastructure/crypto-util.js
 *
 * Criptografia AES-GCM + compressão GZIP.
 *
 * Compatibilidade:
 * V1: Formato antigo, sem compressão.
 * V2: Formato novo, com compressão GZIP.
 *
 * Formato binário:
 * V1: IV (12 bytes) + Ciphertext
 * V2: VERSION (1 byte) + IV (12 bytes) + Ciphertext
 */

const SECRET_KEY_STRING = 'PontoFolha@2026#SyncKey';

const CONFIG = Object.freeze({
  VERSION_COMPRESSED: 2,

  IV_LENGTH: 12,

  SALT: 'ponto-folha-salt',

  ITERATIONS: 100000,

  KEY_LENGTH: 256,

  ALGORITHM: 'AES-GCM',

  HASH: 'SHA-256'
});

// ======================================================
// DERIVAÇÃO DA CHAVE
// ======================================================

async function getCryptoKey() {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET_KEY_STRING),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(CONFIG.SALT),
      iterations: CONFIG.ITERATIONS,
      hash: CONFIG.HASH
    },
    keyMaterial,
    {
      name: CONFIG.ALGORITHM,
      length: CONFIG.KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// ======================================================
// CONVERSÃO BASE64
// ======================================================

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);

  // Evita problemas com argumentos excessivos do String.fromCharCode.
  const CHUNK_SIZE = 0x8000;

  let binary = '';

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + CHUNK_SIZE)
    );
  }

  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// ======================================================
// COMPRESSÃO GZIP
// ======================================================

async function comprimirDados(dados) {
  if (typeof CompressionStream === 'undefined') {
    throw new Error(
      'Este navegador não suporta compressão GZIP.'
    );
  }

  const stream = new Blob([dados])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));

  return new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
}

// ======================================================
// DESCOMPRESSÃO GZIP
// ======================================================

async function descomprimirDados(dados) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Este navegador não suporta descompressão GZIP.'
    );
  }

  const stream = new Blob([dados])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));

  return new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
}

// ======================================================
// CRIPTOGRAFIA
// ======================================================

export async function criptografarDados(dadosJson) {
  try {
    if (typeof dadosJson !== 'string') {
      throw new TypeError(
        'Os dados para criptografia devem ser uma string JSON.'
      );
    }

    const key = await getCryptoKey();

    // 1. Compacta o JSON antes da criptografia.
    const compressed = await comprimirDados(dadosJson);

    // 2. Gera IV aleatório.
    const iv = crypto.getRandomValues(
      new Uint8Array(CONFIG.IV_LENGTH)
    );

    // 3. Criptografa os dados compactados.
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: CONFIG.ALGORITHM,
        iv
      },
      key,
      compressed
    );

    // 4. Monta o pacote:
    // VERSION (1 byte) + IV (12 bytes) + Ciphertext.

    const combined = new Uint8Array(
      1 + iv.length + ciphertext.byteLength
    );

    combined[0] = CONFIG.VERSION_COMPRESSED;

    combined.set(iv, 1);

    combined.set(
      new Uint8Array(ciphertext),
      1 + iv.length
    );

    // 5. Converte para Base64.
    return bufferToBase64(combined);

  } catch (error) {
    console.error('Erro ao criptografar:', error);

    throw error;
  }
}

// ======================================================
// DESCRIPTOGRAFIA
// ======================================================

export async function descriptografarDados(base64String) {
  try {
    if (
      typeof base64String !== 'string' ||
      !base64String.length
    ) {
      throw new TypeError(
        'O conteúdo recebido para descriptografia é inválido.'
      );
    }

    const key = await getCryptoKey();

    // 1. Recupera os bytes originais.
    const bytes = base64ToBuffer(base64String);

    let version;
    let iv;
    let ciphertext;

    // 2. Identifica a versão do pacote.

    if (bytes[0] === CONFIG.VERSION_COMPRESSED) {

      // V2: VERSION + IV + Ciphertext.

      version = 2;

      iv = bytes.slice(1, 1 + CONFIG.IV_LENGTH);

      ciphertext = bytes.slice(
        1 + CONFIG.IV_LENGTH
      );

    } else {

      // V1: IV + Ciphertext.
      // Compatibilidade com QR Codes antigos.

      version = 1;

      iv = bytes.slice(0, CONFIG.IV_LENGTH);

      ciphertext = bytes.slice(CONFIG.IV_LENGTH);
    }

    if (
      iv.length !== CONFIG.IV_LENGTH ||
      ciphertext.length < 16
    ) {
      throw new Error('Pacote criptografado inválido.');
    }

    // 3. Descriptografa.
    const decrypted = await crypto.subtle.decrypt(
      {
        name: CONFIG.ALGORITHM,
        iv
      },
      key,
      ciphertext
    );

    // 4. Descompacta somente os dados da V2.
    const originalData = version === 2
      ? await descomprimirDados(new Uint8Array(decrypted))
      : new Uint8Array(decrypted);

    // 5. Recupera o JSON original.
    return new TextDecoder().decode(originalData);

  } catch (error) {
    console.error('Falha na descriptografia:', error);

    throw new Error(
      'Não foi possível descriptografar os dados. ' +
      'O QR Code pode estar inválido, corrompido ou ser incompatível.'
    );
  }
}
