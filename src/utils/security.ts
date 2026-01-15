import bcrypt from 'react-native-bcrypt';

export class Security {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(userId: number): string {
    // Générer un JWT ou token simple
    return `token_${userId}_${Date.now()}`;
  }
}