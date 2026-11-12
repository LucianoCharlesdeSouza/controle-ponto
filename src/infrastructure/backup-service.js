import { getAllItems, addItem, putItem, getDB } from './database.js';

export const BACKUP_STORES = [
  'colaboradores', 'motivos', 'valoresHora', 'marcacoes', 'ajustes', 'settings'
];

const VERSION = 1;

// Função para calcular o Hash SHA-256 nativo do navegador
async function calcularHash(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function gerarBackupJSON() {
  const data = { version: VERSION, createdAt: new Date().toISOString() };
  
  for (const s of BACKUP_STORES) {
    try {
      data[s] = await getAllItems(s);
    } catch (e) {
      data[s] = []; // Se a store estiver vazia ou não existir, assume array vazio
    }
  }
  
  const dadosString = JSON.stringify(data);
  const checksum = await calcularHash(dadosString);
  
  return JSON.stringify({
    checksum,
    payload: dadosString
  }, null, 2);
}

function nomeArquivo(ext) {
  return `ponto-folha-backup-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export async function baixarBackup() {
  const json = await gerarBackupJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo('ptbackup');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  
  // Salva a data do último backup
  await putItem('settings', { key: 'lastBackupAt', value: new Date().toISOString() });
}

export async function compartilharOuBaixarBackup() {
  const json = await gerarBackupJSON();
  const file = new File([json], nomeArquivo('json'), { type: 'application/json' });
  
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup Ponto & Folha', text: 'Backup do sistema Ponto & Folha' });
      await putItem('settings', { key: 'lastBackupAt', value: new Date().toISOString() });
      return 'share';
    } catch (e) {
      console.warn("Compartilhamento cancelado, usando fallback");
    }
  }
  
  await baixarBackup();
  return 'download';
}

export async function restaurarBackup(file) {
  const text = await file.text();
  let arquivo;
  
  try {
    arquivo = JSON.parse(text);
  } catch {
    throw new Error('Arquivo inválido (não é um JSON válido).');
  }

  if (!arquivo.checksum || !arquivo.payload) {
    throw new Error('Formato de backup inválido ou arquivo não gerado pelo Ponto & Folha.');
  }

  const hashCalculado = await calcularHash(arquivo.payload);
  
  if (hashCalculado !== arquivo.checksum) {
    throw new Error('O arquivo de backup está corrompido ou foi alterado. Restauração bloqueada.');
  }

  const data = JSON.parse(arquivo.payload);

  if (data.version !== VERSION) {
    throw new Error(`Versão de backup incompatível (encontrada ${data.version ?? '?'}, esperada ${VERSION}).`);
  }

  const db = await getDB();
  
  // Limpa e restaura cada store
  for (const storeName of BACKUP_STORES) {
    if (!db.objectStoreNames.contains(storeName)) continue;

    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    // Limpa
    await new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = resolve;
      req.onerror = reject;
    });

    // Insere os novos
    const items = data[storeName] || [];
    for (const item of items) {
      await new Promise((resolve, reject) => {
        const req = store.put(item);
        req.onsuccess = resolve;
        req.onerror = reject;
      });
    }
  }

  await putItem('settings', { key: 'lastRestoreAt', value: new Date().toISOString() });

  return {
    colaboradores: data.colaboradores?.length || 0,
    motivos: data.motivos?.length || 0,
    marcacoes: data.marcacoes?.length || 0,
    valores: data.valoresHora?.length || 0
  };
}

export async function ultimoBackup() {
  try {
    const all = await getAllItems('settings');
    return all.find(x => x.key === 'lastBackupAt')?.value || null;
  } catch {
    return null;
  }
}

export async function ultimoRestore() {
  try {
    const all = await getAllItems('settings');
    return all.find(x => x.key === 'lastRestoreAt')?.value || null;
  } catch {
    return null;
  }
}

export async function estimativaArmazenamento() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try { return await navigator.storage.estimate(); } catch { return null; }
}