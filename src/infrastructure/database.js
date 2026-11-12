// src/infrastructure/database.js
const DB_NAME = 'controle-ponto-db';
const DB_VERSION = 2;

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('Erro ao abrir o banco: ' + event.target.errorCode);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('motivos')) {
        const store = db.createObjectStore('motivos', { keyPath: 'id' });
        store.createIndex('nome', 'nome', { unique: false });
      }
      if (!db.objectStoreNames.contains('colaboradores')) {
        const store = db.createObjectStore('colaboradores', { keyPath: 'id' });
        store.createIndex('situacao', 'situacao', { unique: false });
      }
      if (!db.objectStoreNames.contains('valoresHora')) {
        const store = db.createObjectStore('valoresHora', { keyPath: 'id' });
        store.createIndex('colaboradorId', 'colaboradorId', { unique: false });
      }
      if (!db.objectStoreNames.contains('marcacoes')) {
        const store = db.createObjectStore('marcacoes', { keyPath: 'id' });
        store.createIndex('colaboradorId', 'colaboradorId', { unique: false });
        store.createIndex('dataHoraLocal', 'dataHoraLocal', { unique: false });
      }
      // NOVAS STORES PARA O FUTURO E BACKUP
      if (!db.objectStoreNames.contains('ajustes')) {
        db.createObjectStore('ajustes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
  });
}

// Funções genéricas de CRUD
export async function getDB() {
  if (!window.db) {
    window.db = await initDB();
  }
  return window.db;
}

export async function addItem(storeName, item) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putItem(storeName, item) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllItems(storeName) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}