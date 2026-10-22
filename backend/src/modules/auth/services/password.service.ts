import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { COMMON_PASSWORDS } from '../constants/common-passwords';

@Injectable()
export class PasswordService implements OnModuleInit {
  /** Hash descartável: igualar o tempo do login quando o e-mail não existe. */
  private dummyHash = '';

  async onModuleInit() {
    this.dummyHash = await this.hash('senha-descartavel-para-igualar-tempo');
  }

  hash(plain: string) {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /** Com `hash` nulo (usuário inexistente) ainda gasta o mesmo tempo e devolve false. */
  async verify(hash: string | null, plain: string): Promise<boolean> {
    const valid = await argon2.verify(hash ?? this.dummyHash, plain);
    return hash !== null && valid;
  }

  isCommon(plain: string) {
    return COMMON_PASSWORDS.has(plain.toLowerCase());
  }
}
