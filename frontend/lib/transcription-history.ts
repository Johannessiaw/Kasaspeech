export type TranscriptionEntry = {
  id: string;
  audio: Blob;
  fileName: string;
  mimeType: string;
  transcript: string;
  durationSeconds: number;
  processingMs: number;
  createdAt: string;
};

const DATABASE_NAME = "kasaspeech-studio";
const DATABASE_VERSION = 1;
const STORE_NAME = "transcriptions";

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("This browser does not support local transcription history."),
    );
  }
  if (databasePromise) return databasePromise;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Could not open local transcription history."),
      );
    };
    request.onblocked = () => {
      reject(new Error("Close other KasaSpeech tabs to open local history."));
    };
  });

  databasePromise = opening.catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

export async function saveTranscription(entry: TranscriptionEntry) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        transaction.error ??
          new Error("Could not save this audio to browser history."),
      );
    };
    transaction.onabort = () => {
      reject(
        transaction.error ??
          new Error("Saving this audio to browser history was aborted."),
      );
    };
  });
}

export async function listTranscriptions() {
  const database = await openDatabase();
  return new Promise<TranscriptionEntry[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const entries = request.result as TranscriptionEntry[];
      entries.sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      );
      resolve(entries);
    };
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Could not read local transcription history."),
      );
    };
  });
}

export async function deleteTranscription(id: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        transaction.error ??
          new Error("Could not delete this item from browser history."),
      );
    };
    transaction.onabort = () => {
      reject(
        transaction.error ??
          new Error("Deleting this item from browser history was aborted."),
      );
    };
  });
}
