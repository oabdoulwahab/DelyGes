declare module 'react-native-bcrypt' {
  export function hash(password: string, rounds: number, callback: (error: Error | null, hash: string) => void): void;
  export function compare(password: string, hash: string, callback: (error: Error | null, result: boolean) => void): void;
}