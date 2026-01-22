import * as SecureStore from "expo-secure-store";

const USER_KEY = "AUTH_USER_ID";

export async function saveUserSession(userId: number) {
  await SecureStore.setItemAsync(USER_KEY, String(userId));
}

export async function getUserSession() {
  const id = await SecureStore.getItemAsync(USER_KEY);
  return id ? Number(id) : null;
}

export async function clearUserSession() {
  await SecureStore.deleteItemAsync(USER_KEY);
}
