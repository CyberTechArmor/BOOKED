import { describe, it, expect, beforeAll } from 'vitest';
import {
  encrypt,
  decrypt,
  encryptString,
  decryptString,
  hashSha256,
  generateSecureToken,
  generateApiKey,
} from '../../src/common/utils/encryption.js';

describe('Encryption Utilities', () => {
  beforeAll(() => {
    // Ensure encryption key is set for tests
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted.ciphertext).not.toBe(plaintext);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext', () => {
      const plaintext = 'Test message';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'Hello! @#$%^&*() 日本語 émoji 🎉';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptString/decryptString', () => {
    it('should encrypt to JSON string and decrypt back', () => {
      const plaintext = 'Secret token';
      const encrypted = encryptString(plaintext);

      expect(typeof encrypted).toBe('string');
      expect(() => JSON.parse(encrypted)).not.toThrow();

      const decrypted = decryptString(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('hashSha256', () => {
    it('should produce consistent hash for same input', () => {
      const input = 'test-input';
      const hash1 = hashSha256(input);
      const hash2 = hashSha256(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 256 bits = 64 hex chars
    });

    it('should produce different hash for different inputs', () => {
      const hash1 = hashSha256('input1');
      const hash2 = hashSha256('input2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of correct length', () => {
      const token16 = generateSecureToken(16);
      const token32 = generateSecureToken(32);

      expect(token16).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token32).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key with correct format', () => {
      const { key, hash, prefix } = generateApiKey();

      expect(key).toMatch(/^bk_live_[a-f0-9]{64}$/);
      expect(hash).toHaveLength(64);
      expect(prefix).toBe(key.substring(0, 16));
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1.key).not.toBe(key2.key);
      expect(key1.hash).not.toBe(key2.hash);
    });
  });
});
