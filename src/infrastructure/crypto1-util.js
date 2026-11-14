// src/infrastructure/crypto-util.js

const SECRET_KEY_STRING = 'PontoFolha@2026#SyncKey';

async function getCryptoKey() {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET_KEY_STRING),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('ponto-folha-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Função segura para converter ArrayBuffer para Base64
function bufferToBase64(buffer) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    reader.onload = () => {
      // Remove o prefixo "data:application/octet-stream;base64,"
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Função segura para converter Base64 para ArrayBuffer
function base64ToBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function criptografarDados(dadosJson) {
  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(dadosJson)
    );
    
    // Junta IV + Ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    return await bufferToBase64(combined);
  } catch (error) {
    console.error('Erro ao criptografar:', error);
    throw error;
  }
}

export async function descriptografarDados(base64String) {
  try {
    const key = await getCryptoKey();
    
    // Converte a string Base64 de volta para bytes de forma segura
    const binaryString = window.atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Os primeiros 12 bytes são o IV (Vetor de Inicialização)
    const iv = bytes.slice(0, 12);
    // O restante é o texto criptografado
    const ciphertext = bytes.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (error) {
    console.error('Falha na descriptografia:', error);
    // Se falhar, lança um erro claro para o toast
    throw new Error('Não foi possível descriptografar. O QR Code pode ser de uma versão antiga.');
  }
}