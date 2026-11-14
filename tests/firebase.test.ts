import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  cert: vi.fn(),
  initializeApp: vi.fn(),
  getApps: vi.fn(),
  getApp: vi.fn(),
  getFirestore: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock("firebase-admin/app", () => ({
  cert: sdk.cert,
  initializeApp: sdk.initializeApp,
  getApps: sdk.getApps,
  getApp: sdk.getApp,
}));

vi.mock("firebase-admin/firestore", () => ({ getFirestore: sdk.getFirestore }));
vi.mock("firebase-admin/auth", () => ({ getAuth: sdk.getAuth }));

function prepararSdk(): void {
  sdk.cert.mockReturnValue({});
  sdk.initializeApp.mockReturnValue({ name: "app-de-prueba" });
  sdk.getApps.mockReturnValue([]);
  sdk.getFirestore.mockReturnValue({ nombre: "db" });
  sdk.getAuth.mockReturnValue({ nombre: "auth" });
}

describe("inicialización de Firebase Admin", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    prepararSdk();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falla con un mensaje claro si faltan variables de entorno", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "");

    const { getDb } = await import("@/src/lib/firebase");

    expect(() => getDb()).toThrow(/FIREBASE_PROJECT_ID/);
    expect(() => getDb()).toThrow(/FIREBASE_CLIENT_EMAIL/);
    expect(() => getDb()).toThrow(/FIREBASE_PRIVATE_KEY/);
  });

  it("convierte los \\n literales y memoiza Firestore y Auth", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "proyecto-prueba");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "cuenta@example.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "linea1\\nlinea2");

    const { getAuthAdmin, getDb } = await import("@/src/lib/firebase");

    getDb();
    getDb();
    getAuthAdmin();
    getAuthAdmin();

    expect(sdk.cert).toHaveBeenCalledWith({
      projectId: "proyecto-prueba",
      clientEmail: "cuenta@example.com",
      privateKey: "linea1\nlinea2",
    });
    expect(sdk.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdk.getFirestore).toHaveBeenCalledTimes(1);
    expect(sdk.getAuth).toHaveBeenCalledTimes(1);
  });
});

describe("reutilización de la app de Firebase Admin", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    prepararSdk();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reutiliza la app existente en lugar de inicializar otra", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "proyecto-prueba");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "cuenta@example.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "linea1\\nlinea2");
    sdk.getApps.mockReturnValue([{ name: "app-existente" }]);
    sdk.getApp.mockReturnValue({ name: "app-existente" });

    const { getDb } = await import("@/src/lib/firebase");

    getDb();

    expect(sdk.getApp).toHaveBeenCalledTimes(1);
    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });
});
