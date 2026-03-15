// src/auth/constants.ts
import * as fs from 'fs';
import * as path from 'path';

const publicKeyPath = path.join(process.cwd(), 'keys/public.pem');

// Debugging
console.log('Public key path:', publicKeyPath);

if (!fs.existsSync(publicKeyPath)) {
  throw new Error(
    `Missing public key at: ${publicKeyPath}\nCurrent directory: ${process.cwd()}`,
  );
}

export const jwtConstants = {
  publicKey: fs.readFileSync(publicKeyPath, 'utf8'),
  algorithm: 'RS256' as const,
};
