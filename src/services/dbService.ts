import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: false,
    },
    operationType,
    path,
  };
  console.error("Firestore Error Detailed: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        clean[key] = cleanUndefined(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean as T;
}

// Interfaces
export interface Registration {
  id: string;
  nik: string;
  name: string;
  phone: string;
  address: string;
  kabKota: string;
  color: string;
  ktpBase64?: string;
  registeredAt: string;
  signatureBase64?: string;
}

export interface Attendance {
  id: string;
  nik: string;
  name: string;
  day: number;
  signatureBase64: string;
  attendedAt: string;
}

export interface AppSettings {
  id: string;
  eventTitle: string;
  durationDays: number;
  gasLink: string;
  startDate?: string;
  eventLocation?: string;
  cardTemplateBase64?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: "default",
  eventTitle: "Bimbingan Teknis Digitalisasi Destinasi Wisata Sumatera Barat",
  durationDays: 3,
  gasLink: "",
  startDate: "2026-05-21",
  eventLocation: "Pangeran Beach Hotel, Padang, Sumatera Barat",
};

// Local storage fallback helper keys
const LS_KEYS = {
  REGISTRATIONS: "bimtek_registrations",
  ATTENDANCE: "bimtek_attendance",
  SETTINGS: "bimtek_settings",
};

export const dbService = {
  // SETTINGS SUBSCRIBER (REAL-TIME)
  subscribeSettings(callback: (settings: AppSettings) => void): () => void {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, "settings", "default");
        return onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            callback(docSnap.data() as AppSettings);
          } else {
            setDoc(docRef, DEFAULT_SETTINGS).then(() => {
              callback(DEFAULT_SETTINGS);
            });
          }
        }, (error) => {
          console.error("Firestore settings onSnapshot error:", error);
          callback(this.getLocalSettings());
        });
      } catch (err) {
        console.warn("Settings subscription failed:", err);
        callback(this.getLocalSettings());
        return () => {};
      }
    } else {
      callback(this.getLocalSettings());
      return () => {};
    }
  },

  // REGISTRATIONS SUBSCRIBER (REAL-TIME)
  subscribeRegistrations(callback: (registrations: Registration[]) => void): () => void {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, "registrations");
        return onSnapshot(colRef, (colSnap) => {
          const data: Registration[] = [];
          colSnap.forEach((docSnap) => {
            data.push(docSnap.data() as Registration);
          });
          const sorted = data.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
          
          // Sync live data to local cache to ensure exact consistency (important for deleted records)
          localStorage.setItem(LS_KEYS.REGISTRATIONS, JSON.stringify(sorted));
          
          callback(sorted);
        }, (error) => {
          console.error("Firestore registrations onSnapshot error:", error);
          callback(this.getLocalRegistrations());
        });
      } catch (err) {
        console.warn("Registrations subscription failed:", err);
        callback(this.getLocalRegistrations());
        return () => {};
      }
    } else {
      callback(this.getLocalRegistrations());
      return () => {};
    }
  },

  // ATTENDANCE SUBSCRIBER (REAL-TIME)
  subscribeAttendance(callback: (attendance: Attendance[]) => void): () => void {
    if (isFirebaseConfigured && db) {
      try {
        const colRef = collection(db, "attendance");
        return onSnapshot(colRef, (colSnap) => {
          const data: Attendance[] = [];
          colSnap.forEach((docSnap) => {
            data.push(docSnap.data() as Attendance);
          });
          const sorted = data.sort((a, b) => new Date(b.attendedAt).getTime() - new Date(a.attendedAt).getTime());
          
          // Sync live data to local cache
          localStorage.setItem(LS_KEYS.ATTENDANCE, JSON.stringify(sorted));
          
          callback(sorted);
        }, (error) => {
          console.error("Firestore attendance onSnapshot error:", error);
          callback(this.getLocalAttendance());
        });
      } catch (err) {
        console.warn("Attendance subscription failed:", err);
        callback(this.getLocalAttendance());
        return () => {};
      }
    } else {
      callback(this.getLocalAttendance());
      return () => {};
    }
  },

  // SETTINGS
  async getSettings(): Promise<AppSettings> {
    if (isFirebaseConfigured && db) {
      const path = "settings/default";
      try {
        const docRef = doc(db, "settings", "default");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data() as AppSettings;
        } else {
          // Initialize if empty
          await setDoc(docRef, DEFAULT_SETTINGS);
          return DEFAULT_SETTINGS;
        }
      } catch (error) {
        try {
          return handleFirestoreError(error, OperationType.GET, path);
        } catch {
          // If firestore threw an error but we still need settings to let the app run:
          return this.getLocalSettings();
        }
      }
    } else {
      return this.getLocalSettings();
    }
  },

  getLocalSettings(): AppSettings {
    const raw = localStorage.getItem(LS_KEYS.SETTINGS);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    if (isFirebaseConfigured && db) {
      const path = "settings/default";
      try {
        const docRef = doc(db, "settings", "default");
        const cleanData = cleanUndefined(settings);
        await setDoc(docRef, cleanData);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } else {
      localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
    }
    // Also save locally as redundancy/cache
    localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // REGISTRATIONS
  async addRegistration(reg: Registration): Promise<void> {
    if (isFirebaseConfigured && db) {
      const path = `registrations/${reg.id}`;
      try {
        const docRef = doc(db, "registrations", reg.id);
        const cleanData = cleanUndefined(reg);
        await setDoc(docRef, cleanData);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
    
    // Always store or cache in localStorage for instant retrieval / offline resilient flow
    const existing = this.getLocalRegistrations();
    const updated = [reg, ...existing.filter((item) => item.id !== reg.id)];
    localStorage.setItem(LS_KEYS.REGISTRATIONS, JSON.stringify(updated));

    // Async sync in background to Google Sheets if App Settings has a GAS Link
    const settings = await this.getSettings();
    if (settings.gasLink) {
      this.syncToGoogleSheets(settings.gasLink, { type: "registration", data: reg });
    }
  },

  getLocalRegistrations(): Registration[] {
    const raw = localStorage.getItem(LS_KEYS.REGISTRATIONS);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  },

  async getRegistrations(): Promise<Registration[]> {
    if (isFirebaseConfigured && db) {
      const path = "registrations";
      try {
        const colSnap = await getDocs(collection(db, "registrations"));
        const data: Registration[] = [];
        colSnap.forEach((doc) => {
          data.push(doc.data() as Registration);
        });
        // Sort newest first
        return data.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      } catch (error) {
        try {
          return handleFirestoreError(error, OperationType.LIST, path);
        } catch {
          return this.getLocalRegistrations();
        }
      }
    } else {
      return this.getLocalRegistrations();
    }
  },

  async deleteRegistration(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      const path = `registrations/${id}`;
      try {
        await deleteDoc(doc(db, "registrations", id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
    const existing = this.getLocalRegistrations();
    const updated = existing.filter((doc) => doc.id !== id);
    localStorage.setItem(LS_KEYS.REGISTRATIONS, JSON.stringify(updated));
  },

  // ATTENDANCE
  async addAttendance(att: Attendance): Promise<void> {
    if (isFirebaseConfigured && db) {
      const path = `attendance/${att.id}`;
      try {
        const docRef = doc(db, "attendance", att.id);
        const cleanData = cleanUndefined(att);
        await setDoc(docRef, cleanData);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }

    // Cache locally
    const existing = this.getLocalAttendance();
    const updated = [att, ...existing.filter((item) => item.id !== att.id)];
    localStorage.setItem(LS_KEYS.ATTENDANCE, JSON.stringify(updated));

    // Dynamic external syncing
    const settings = await this.getSettings();
    if (settings.gasLink) {
      this.syncToGoogleSheets(settings.gasLink, { type: "attendance", data: att });
    }
  },

  getLocalAttendance(): Attendance[] {
    const raw = localStorage.getItem(LS_KEYS.ATTENDANCE);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  },

  async getAttendanceList(): Promise<Attendance[]> {
    if (isFirebaseConfigured && db) {
      const path = "attendance";
      try {
        const colSnap = await getDocs(collection(db, "attendance"));
        const data: Attendance[] = [];
        colSnap.forEach((doc) => {
          data.push(doc.data() as Attendance);
        });
        return data.sort((a, b) => new Date(b.attendedAt).getTime() - new Date(a.attendedAt).getTime());
      } catch (error) {
        try {
          return handleFirestoreError(error, OperationType.LIST, path);
        } catch {
          return this.getLocalAttendance();
        }
      }
    } else {
      return this.getLocalAttendance();
    }
  },

  async deleteAttendance(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      const path = `attendance/${id}`;
      try {
        await deleteDoc(doc(db, "attendance", id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
    const existing = this.getLocalAttendance();
    const updated = existing.filter((doc) => doc.id !== id);
    localStorage.setItem(LS_KEYS.ATTENDANCE, JSON.stringify(updated));
  },

  async clearAllData(): Promise<void> {
    // 1. Wipe local cache/storage
    localStorage.removeItem(LS_KEYS.REGISTRATIONS);
    localStorage.removeItem(LS_KEYS.ATTENDANCE);

    // 2. Clear Firebase Firestore collections if live
    if (isFirebaseConfigured && db) {
      try {
        const regSnap = await getDocs(collection(db, "registrations"));
        const deleteRegPromises = regSnap.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(deleteRegPromises);

        const attSnap = await getDocs(collection(db, "attendance"));
        const deleteAttPromises = attSnap.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(deleteAttPromises);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, "all-registrations-and-attendance");
      }
    }
  },

  // BACKGROUND GOOGLE SHEETS SINK SCRIPT SYNC
  syncToGoogleSheets(gasLink: string, payload: { type: "registration" | "attendance"; data: any }) {
    if (!gasLink || !gasLink.startsWith("http")) return;
    
    // We send via fetch no-cors to bypass sandbox iframe CORS blocks or let GAS receive
    fetch(gasLink, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(() => console.log("🔄 Automatic sheets sync sent payload:", payload.type))
      .catch((err) => console.warn("🔄 Sheets sync failed (expected if mock gas server):", err));
  }
};
