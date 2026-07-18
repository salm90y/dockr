export const collection = (...args: any[]) => ({});
export const doc = (...args: any[]) => ({ id: Math.random().toString(36).substring(7) });
export const setDoc = async (...args: any[]) => {};
export const deleteDoc = async (...args: any[]) => {};
export const updateDoc = async (...args: any[]) => {};
export const onSnapshot = (...args: any[]) => () => {};
export const getDoc = async (...args: any[]) => ({ exists: () => false, data: () => ({}) });
export const db = {};
export const auth = {};
export const onAuthStateChanged = (...args: any[]) => () => {};
export const signOut = async (...args: any[]) => {};
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
export const handleFirestoreError = (...args: any[]) => {};
export type User = any;
