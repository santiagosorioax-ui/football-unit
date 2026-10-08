import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TeamCustomization, GlobalStats } from '../types/game';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with explicit database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined || data === null) {
    return null as any;
  }
  if (typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

export function getReadableErrorMessage(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado al conectar con el servidor.';
  const str = error instanceof Error ? error.message : String(error);
  if (str.includes('permission-denied') || str.includes('insufficient permissions')) {
    return 'Permisos denegados temporalmente. Reintentando sincronización...';
  }
  if (str.includes('offline') || str.includes('unavailable') || str.includes('network')) {
    return 'Problemas de red o cliente sin conexión a internet.';
  }
  if (str.includes('no existe') || str.includes('not-found')) {
    return 'La sala de partido no existe o ha expirado.';
  }
  if (str.includes('no está disponible') || str.includes('ocupada')) {
    return 'La sala ya no está disponible o el rival ya comenzó.';
  }
  try {
    const parsed = JSON.parse(str);
    if (parsed.error) return getReadableErrorMessage(parsed.error);
  } catch {}
  return 'Error de conexión en línea. Intentando reconectar...';
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Info:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection as required by Firebase guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
    }
    return false;
  }
}

// Authentication Helpers
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: unknown) {
    console.error('Error during Google sign-in:', error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: unknown) {
    console.error('Error during sign out:', error);
    throw error;
  }
}

export interface UserGameSaveData {
  userId: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  coins: number;
  stats: GlobalStats;
  team: TeamCustomization;
  unlockedPlayerIds: string[];
  unlockedAchievementIds: string[];
  updatedAt: string;
}

// Save user game state to Firestore
export async function saveUserDataToFirestore(
  userId: string,
  data: Partial<UserGameSaveData>
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        userId,
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Load user game state from Firestore
export async function loadUserDataFromFirestore(
  userId: string
): Promise<UserGameSaveData | null> {
  const path = `users/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists()) {
      return docSnap.data() as UserGameSaveData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// ==========================================
// REAL-TIME MULTIPLAYER MATCH FUNCTIONS
// ==========================================

export interface MatchRoomData {
  id: string;
  status: 'waiting' | 'starting' | 'playing' | 'finished' | 'abandoned';
  hostId: string;
  hostName: string;
  hostTeam: TeamCustomization;
  guestId?: string | null;
  guestName?: string | null;
  guestTeam?: TeamCustomization | null;
  scoreHome: number;
  scoreAway: number;
  period?: string;
  timeRemaining?: number;
  ballPos?: { x: number; y: number; z: number };
  hostPlayerPos?: { x: number; z: number; angle?: number; action?: string };
  guestPlayerPos?: { x: number; z: number; angle?: number; action?: string };
  lastGoalScoredBy?: 'home' | 'away' | null;
  lastGoalTimestamp?: number;
  winner?: 'home' | 'away' | 'tie' | null;
  createdAt: string;
  updatedAt: string;
}

// Create a new match room (Host)
export async function createMatchRoom(
  hostPlayer: { id: string; name: string; team: TeamCustomization },
  customCode?: string
): Promise<MatchRoomData> {
  const cleanCode = customCode ? customCode.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().trim() : '';
  const roomId = cleanCode
    ? cleanCode
    : 'match_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const path = `matches/${roomId}`;

  const roomData: MatchRoomData = {
    id: roomId,
    status: 'waiting',
    hostId: hostPlayer.id,
    hostName: hostPlayer.name || 'Anfitrión',
    hostTeam: hostPlayer.team,
    guestId: null,
    guestName: null,
    guestTeam: null,
    scoreHome: 0,
    scoreAway: 0,
    period: '1st_half',
    timeRemaining: 120,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const sanitized = sanitizeForFirestore(roomData);
    await setDoc(doc(db, 'matches', roomId), sanitized);
    return roomData;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Search for an existing open waiting match
export async function findPublicMatchRoom(
  currentUserId: string
): Promise<MatchRoomData | null> {
  const path = 'matches';
  try {
    const q = query(
      collection(db, path),
      where('status', '==', 'waiting'),
      limit(20)
    );
    const snap = await getDocs(q);
    const now = Date.now();
    for (const d of snap.docs) {
      const data = d.data() as MatchRoomData;
      // Do not join our own room if already waiting
      if (data.hostId === currentUserId) {
        continue;
      }

      // Check if room is fresh (created/updated within the last 60 seconds)
      const roomTime = new Date(data.updatedAt || data.createdAt).getTime();
      if (isNaN(roomTime) || now - roomTime > 60000) {
        continue;
      }

      return data;
    }
    return null;
  } catch (error) {
    console.warn('Warning: Could not fetch waiting match rooms:', error);
    return null;
  }
}

// Join an existing match room (Guest)
export async function joinMatchRoom(
  roomId: string,
  guestPlayer: { id: string; name: string; team: TeamCustomization }
): Promise<MatchRoomData> {
  const cleanId = roomId.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().trim();
  const path = `matches/${cleanId}`;
  try {
    const docRef = doc(db, 'matches', cleanId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`La sala "${cleanId}" no existe.`);
    }

    const currentData = docSnap.data() as MatchRoomData;
    if (currentData.status !== 'waiting') {
      throw new Error('La sala ya no está disponible o el partido ya comenzó.');
    }

    const updates: Partial<MatchRoomData> = {
      guestId: guestPlayer.id,
      guestName: guestPlayer.name || 'Rival Online',
      guestTeam: guestPlayer.team,
      status: 'starting',
      updatedAt: new Date().toISOString(),
    };

    const sanitizedUpdates = sanitizeForFirestore(updates);
    await updateDoc(docRef, sanitizedUpdates);
    return { ...currentData, ...updates };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Listen to real-time room updates
export function listenToMatchRoom(
  roomId: string,
  onUpdate: (data: MatchRoomData | null) => void
): Unsubscribe {
  const cleanId = roomId.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().trim();
  const path = `matches/${cleanId}`;
  const docRef = doc(db, 'matches', cleanId);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as MatchRoomData);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Listener warning for match room:', error);
    }
  );
}

// Update match room state (scores, positions, status)
export async function updateMatchRoomState(
  roomId: string,
  updates: Partial<MatchRoomData>
): Promise<void> {
  const cleanId = roomId.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().trim();
  const path = `matches/${cleanId}`;
  try {
    const sanitized = sanitizeForFirestore({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'matches', cleanId), sanitized);
  } catch (error) {
    console.warn('Failed to update match room state:', error);
  }
}

// Leave or cancel match room (ONLY marks abandoned if actively playing, deletes if waiting)
export async function leaveOrCancelMatchRoom(
  roomId: string,
  playerId: string
): Promise<void> {
  const cleanId = roomId.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().trim();
  const path = `matches/${cleanId}`;
  try {
    const docRef = doc(db, 'matches', cleanId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const data = snap.data() as MatchRoomData;
    if (data.status === 'waiting' && data.hostId === playerId) {
      await deleteDoc(docRef).catch(() => {});
    } else if (data.status === 'playing') {
      await updateDoc(docRef, {
        status: 'abandoned',
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch (error) {
    console.warn('Error during leaveOrCancelMatchRoom:', error);
  }
}

export { onAuthStateChanged };

