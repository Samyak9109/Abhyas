// FR-005, NFR-005, ADR-005: Optional passphrase-based key encryption using WebCrypto (PBKDF2 + AES-GCM).
// Keys can be stored encrypted at rest in IndexedDB; the decrypted key stays only in memory during the session.

export interface EncryptedPayload {
  version: 1;
  salt: string; // hex
  iv: string; // hex
  ciphertext: string; // hex
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

type SubtleCryptoType = typeof globalThis.crypto.subtle;
type CryptoKeyType = Awaited<ReturnType<SubtleCryptoType["importKey"]>>;

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  subtle: SubtleCryptoType
): Promise<CryptoKeyType> {
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts an API key with a user passphrase using AES-GCM 256 and PBKDF2.
 * Returns a JSON string containing the encrypted payload.
 */
export async function encryptApiKey(apiKey: string, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 1) {
    throw new Error("Passphrase must not be empty");
  }
  if (!apiKey) {
    throw new Error("API key must not be empty");
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto SubtleCrypto is not available in this environment");
  }

  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const cryptoKey = await deriveAesKey(passphrase, salt, subtle);
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(apiKey);

  const ciphertextBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    cryptoKey,
    encodedData
  );

  const payload: EncryptedPayload = {
    version: 1,
    salt: arrayBufferToHex(salt.buffer),
    iv: arrayBufferToHex(iv.buffer),
    ciphertext: arrayBufferToHex(ciphertextBuffer),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypts an encrypted API key payload using the user passphrase.
 * Throws an error if the passphrase is wrong or the payload has been tampered with.
 */
export async function decryptApiKey(encryptedJson: string, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 1) {
    throw new Error("Passphrase must not be empty");
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto SubtleCrypto is not available in this environment");
  }

  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(encryptedJson) as EncryptedPayload;
  } catch {
    throw new Error("Invalid encrypted key payload: not valid JSON");
  }

  if (payload.version !== 1 || !payload.salt || !payload.iv || !payload.ciphertext) {
    throw new Error("Invalid encrypted key payload format");
  }

  const salt = new Uint8Array(hexToArrayBuffer(payload.salt));
  const iv = new Uint8Array(hexToArrayBuffer(payload.iv));
  const ciphertext = hexToArrayBuffer(payload.ciphertext);

  const cryptoKey = await deriveAesKey(passphrase, salt, subtle);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      cryptoKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch {
    throw new Error("Incorrect passphrase or corrupted encrypted key");
  }
}
