// End-to-End Encryption (E2EE) helper module using Web Crypto API (ECDH + AES-GCM)

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface E2EKeyPair {
  privateKeyJwk: string;
  publicKeyJwk: string;
}

export function isWebCryptoSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.isSecureContext && window.crypto?.subtle);
}

// Generate an Elliptic Curve Diffie-Hellman (ECDH) key pair on the P-256 curve
export async function generateE2EKeyPair(): Promise<E2EKeyPair> {
  if (!isWebCryptoSupported()) {
    throw new Error('End-to-end encryption requires a secure HTTPS connection.');
  }
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const privateKey = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);

  return {
    privateKeyJwk: JSON.stringify(privateKey),
    publicKeyJwk: JSON.stringify(publicKey),
  };
}

// Derive a shared 256-bit AES-GCM key from User A's private key and User B's public key
export async function deriveSharedKey(
  privateKeyJwkString: string,
  partnerPublicKeyJwkString: string
): Promise<CryptoKey> {
  const privateKeyJwk = JSON.parse(privateKeyJwkString);
  const partnerPublicKeyJwk = JSON.parse(partnerPublicKeyJwkString);

  // Strip key_ops so import usages aren't constrained by the JWK's stored ops,
  // which would otherwise cause a DataError ("key_ops ... must be a superset").
  delete privateKeyJwk.key_ops;
  delete partnerPublicKeyJwk.key_ops;

  const privateKey = await window.crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );

  const partnerPublicKey = await window.crypto.subtle.importKey(
    'jwk',
    partnerPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: partnerPublicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plain text using derived AES-GCM key
export async function encryptMessage(text: string, cryptoKey: CryptoKey): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    cryptoKey,
    encodedText
  );

  const payload = {
    iv: arrayBufferToBase64(iv.buffer),
    ct: arrayBufferToBase64(ciphertext),
  };

  return `__E2EE__:${JSON.stringify(payload)}`;
}

// Decrypt ciphertext using derived AES-GCM key
export async function decryptMessage(encryptedPayloadString: string, cryptoKey: CryptoKey): Promise<string> {
  if (!encryptedPayloadString.startsWith('__E2EE__:')) {
    return encryptedPayloadString; // Return unencrypted text as fallback
  }

  try {
    const rawJson = encryptedPayloadString.substring(9);
    const payload = JSON.parse(rawJson);

    const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
    const ciphertext = base64ToArrayBuffer(payload.ct);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    // A mismatch (wrong key/IV or legacy ciphertext) is expected during
    // best-effort decryption; callers handle the placeholder, so we stay quiet.
    return '🔒 [Decryption failed: Key mismatch or tampered payload]';
  }
}

// Derive a fallback key using PBKDF2 for instant encryption compatibility
export async function deriveFallbackKey(conversationId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(conversationId),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const salt = encoder.encode('mdp_fallback_e2ee_salt_2026');
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 1000,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedText(text?: string | null): boolean {
  if (!text || typeof text !== 'string') return false;
  return (
    text.includes('__E2EE__:') ||
    text.includes('_E2EE_') ||
    (text.includes('"iv":') && text.includes('"ct":'))
  );
}

async function decryptMessagePayload(payload: { iv: string; ct: string }, key: CryptoKey): Promise<string | null> {
  try {
    const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
    const ciphertext = base64ToArrayBuffer(payload.ct);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function smartDecryptText(
  text?: string | null,
  currentUserId?: string,
  partnerUserId?: string,
  conversationId?: string,
  partnerPublicKeyJwk?: string,
  userPrivateKeyJwk?: string
): Promise<string> {
  if (!text || typeof text !== 'string') return '';
  if (!isEncryptedText(text)) return text;

  let rawJson = text;
  if (rawJson.includes('__E2EE__:')) {
    rawJson = rawJson.substring(rawJson.indexOf('__E2EE__:') + 9);
  } else if (rawJson.includes('_E2EE_')) {
    rawJson = rawJson.replace(/^.*?_E2EE_\s*:\s*/, '');
  }

  let payload: { iv: string; ct: string } | null = null;
  try {
    payload = JSON.parse(rawJson.trim());
  } catch {
    return text;
  }

  if (!payload || typeof payload !== 'object' || !payload.iv || !payload.ct) {
    return text;
  }

  // Candidate seeds for fallback key derivation
  const seeds: string[] = [];
  if (currentUserId && partnerUserId) {
    seeds.push([currentUserId, partnerUserId].sort().join('_'));
  }
  if (conversationId) seeds.push(conversationId);
  if (partnerUserId) seeds.push(partnerUserId);
  if (currentUserId) seeds.push(currentUserId);
  seeds.push('default');

  // Try ECDH key first if JWKs present
  if (partnerPublicKeyJwk && userPrivateKeyJwk) {
    try {
      const ecdhKey = await deriveSharedKey(userPrivateKeyJwk, partnerPublicKeyJwk);
      const decrypted = await decryptMessagePayload(payload, ecdhKey);
      if (decrypted) return decrypted;
    } catch {
      /* continue to fallback seeds */
    }
  }

  // Try candidate fallback keys
  for (const seed of seeds) {
    try {
      const fallbackKey = await deriveFallbackKey(seed);
      const decrypted = await decryptMessagePayload(payload, fallbackKey);
      if (decrypted) return decrypted;
    } catch {
      /* continue */
    }
  }

  return '🔒 Encrypted message';
}

