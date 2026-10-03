/**
 * Cifrado simetrico para secretos que el backend necesita leer de vuelta (a
 * diferencia de un password, que solo se compara contra un hash). Se usa para
 * guardar el secreto TOTP en la base de datos sin dejarlo en claro.
 */
export interface SecretCipherPort {
  encrypt(plainText: string): string;
  decrypt(cipherText: string): string;
}
