import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { getConfig } from '../../infrastructure/config/index.js';

const ALGORITHM = 'aes-256-gcm';

interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
}

function getEncryptionKey(): Buffer {
  const config = getConfig();
  if (!config.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not configured');
  }
  return Buffer.from(config.ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  };
}

export function decrypt(data: EncryptedData): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(data.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

  let plaintext = decipher.update(data.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

export function encryptString(plaintext: string): string {
  const encrypted = encrypt(plaintext);
  return JSON.stringify(encrypted);
}

export function decryptString(encryptedJson: string): string {
  const data = JSON.parse(encryptedJson) as EncryptedData;
  return decrypt(data);
}

export function hashSha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateSecureToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `bk_live_${randomBytes(32).toString('hex')}`;
  const hash = hashSha256(key);
  const prefix = key.substring(0, 16);
  return { key, hash, prefix };
}
