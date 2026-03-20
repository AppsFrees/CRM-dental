const DB_NAME = "crm_dental_pro";
const DB_VERSION = 1;
let db = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("patients")) {
        db.createObjectStore("patients", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("appointments")) {
        const store = db.createObjectStore("appointments", { keyPath: "id" });
        store.createIndex("by_date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains("toothRecords")) {
        db.createObjectStore("toothRecords", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("treatments")) {
        db.createObjectStore("treatments", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("payments")) {
        db.createObjectStore("payments", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("clinicalHistories")) {
        db.createObjectStore("clinicalHistories", { keyPath: "patientId" });
      }
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("Error al abrir IndexedDB", event.target.error);
      reject(event.target.error);
    };
  });
}

function dbGetAll(storeName) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
}

function dbGet(storeName, key) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

function dbPut(storeName, value) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.put(value);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  });
}

function dbDelete(storeName, key) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}
