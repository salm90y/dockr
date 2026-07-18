export const collection = () => ({});
export const doc = () => ({});
export const setDoc = async () => {};
export const deleteDoc = async () => {};
export const updateDoc = async () => {};
export const onSnapshot = () => () => {};
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const db = {};
export const auth = {};
export const onAuthStateChanged = () => () => {};
export const signOut = async () => {};
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
export const handleFirestoreError = () => {};
export type User = any;
