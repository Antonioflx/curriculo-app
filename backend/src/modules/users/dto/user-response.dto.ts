/** Saída pública do usuário: nunca expõe passwordHash. */
export class UserResponseDto {
  id: string;
  name: string;
  email: string;
  createdAt: Date;

  static from(user: UserResponseDto): UserResponseDto {
    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  }
}
