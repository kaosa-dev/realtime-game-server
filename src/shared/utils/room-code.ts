import { randomInt } from 'node:crypto';

export function generateRoomCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }
  return code;
}
