// FR-005, NFR-005, ADR-005: WebCrypto API key encryption and decryption tests.
import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "./encryption";

describe("API Key Encryption (WebCrypto PBKDF2 + AES-GCM)", () => {
  it("encrypts and decrypts an API key successfully", async () => {
    const rawKey = "AIzaSyTestApiKeyForGemini123456789";
    const passphrase = "correct horse battery staple";

    const encryptedJson = await encryptApiKey(rawKey, passphrase);
    expect(typeof encryptedJson).toBe("string");
    expect(encryptedJson).not.toContain(rawKey);

    const decrypted = await decryptApiKey(encryptedJson, passphrase);
    expect(decrypted).toBe(rawKey);
  });

  it("produces different ciphertexts for the same key due to random salt and IV", async () => {
    const rawKey = "sk-test-openai-key-abc-123";
    const passphrase = "super-secret-passphrase";

    const enc1 = await encryptApiKey(rawKey, passphrase);
    const enc2 = await encryptApiKey(rawKey, passphrase);

    expect(enc1).not.toBe(enc2);

    expect(await decryptApiKey(enc1, passphrase)).toBe(rawKey);
    expect(await decryptApiKey(enc2, passphrase)).toBe(rawKey);
  });

  it("fails decryption with wrong passphrase", async () => {
    const rawKey = "sk-test-openai-key-abc-123";
    const encryptedJson = await encryptApiKey(rawKey, "correct-passphrase");

    await expect(decryptApiKey(encryptedJson, "wrong-passphrase")).rejects.toThrow(
      "Incorrect passphrase or corrupted encrypted key"
    );
  });

  it("rejects empty passphrase or empty key", async () => {
    await expect(encryptApiKey("", "pass")).rejects.toThrow("API key must not be empty");
    await expect(encryptApiKey("key", "")).rejects.toThrow("Passphrase must not be empty");
    await expect(decryptApiKey("{}", "")).rejects.toThrow("Passphrase must not be empty");
  });

  it("rejects invalid or tampered JSON payloads", async () => {
    await expect(decryptApiKey("invalid json", "pass")).rejects.toThrow(
      "Invalid encrypted key payload: not valid JSON"
    );

    const tampered = JSON.stringify({ version: 2, salt: "123", iv: "456", ciphertext: "789" });
    await expect(decryptApiKey(tampered, "pass")).rejects.toThrow(
      "Invalid encrypted key payload format"
    );
  });
});
