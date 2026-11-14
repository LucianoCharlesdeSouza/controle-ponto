// ATENÇÃO: Em produção, isso deveria vir de uma variável de ambiente ou ser derivado de algo único.
// Para este MVP, usamos uma chave fixa.
const SECRET_KEY_STRING = 'PontoFolha@2026#SyncKey';

// Função auxiliar para derivar uma chave AES-GCM a partir da string
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
      salt: enc.encode('ponto-folha-salt'), // Salt fixo para derivar sempre a mesma chave
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function criptografarDados(dadosJson) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV aleatório para cada criptografia
  const enc = new TextEncoder();
  const encoded = enc.encode(dadosJson);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  // Junta o IV e o ciphertext em um único array e converte para Base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function descriptografarDados(base64String) {
  const key = await getCryptoKey();
  const combined = new Uint8Array(atob(base64String).split('').map(c => c.charCodeAt(0)));
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}