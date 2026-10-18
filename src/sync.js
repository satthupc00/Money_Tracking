// Đồng bộ đám mây: Firebase Auth (email + mật khẩu) + Firestore.
// Toàn bộ dữ liệu của 1 tài khoản nằm trong 1 document: users/{uid}/state/main
//   { data, categoriesByYear, goal, updatedAt (ms), deviceId }
// Tải thư viện Firebase theo kiểu lazy để app mở nhanh, kể cả khi mất mạng.
import { FIREBASE_CONFIG } from './config.js';
import { lsGet, lsSet } from './platform.js';

let fb = null; // { auth, db, mod: {...các hàm firebase} }

async function ensureFirebase() {
  if (fb) return fb;
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(FIREBASE_CONFIG);
  // initializeAuth (không dùng getAuth) để không kéo theo popup/redirect resolver - chạy ổn trong WebView Android và Electron
  const auth = authMod.initializeAuth(app, {
    persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence],
  });
  const db = fsMod.getFirestore(app);
  fb = { auth, db, a: authMod, f: fsMod };
  return fb;
}

export function getDeviceId() {
  let id = lsGet('mmt-device-id');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    lsSet('mmt-device-id', id);
  }
  return id;
}

export async function watchAuth(cb) {
  const { auth, a } = await ensureFirebase();
  return a.onAuthStateChanged(auth, (user) => cb(user ? { uid: user.uid, email: user.email } : null));
}

const AUTH_ERRORS = {
  'auth/invalid-email': 'Email không hợp lệ',
  'auth/invalid-credential': 'Sai email hoặc mật khẩu',
  'auth/wrong-password': 'Sai email hoặc mật khẩu',
  'auth/user-not-found': 'Sai email hoặc mật khẩu',
  'auth/missing-password': 'Chưa nhập mật khẩu',
  'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự',
  'auth/email-already-in-use': 'Email này đã có tài khoản, hãy đăng nhập',
  'auth/too-many-requests': 'Thử sai nhiều lần, đợi một lát rồi thử lại',
  'auth/network-request-failed': 'Không có kết nối mạng',
  'auth/operation-not-allowed': 'Tài khoản đồng bộ chưa bật đăng nhập bằng email',
};
export function authErrorText(err) {
  return AUTH_ERRORS[err && err.code] || 'Lỗi: ' + ((err && (err.code || err.message)) || 'không rõ');
}

export async function signIn(email, password) {
  const { auth, a } = await ensureFirebase();
  await a.signInWithEmailAndPassword(auth, email.trim(), password);
}
export async function signUp(email, password) {
  const { auth, a } = await ensureFirebase();
  await a.createUserWithEmailAndPassword(auth, email.trim(), password);
}
export async function signOut() {
  const { auth, a } = await ensureFirebase();
  await a.signOut(auth);
}
// Xác minh lại mật khẩu tài khoản (dùng cho "Quên mã PIN")
export async function verifyAccountPassword(password) {
  const { auth, a } = await ensureFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');
  const cred = a.EmailAuthProvider.credential(user.email, password);
  await a.reauthenticateWithCredential(user, cred);
}

// Theo dõi document dữ liệu. cb(remote | null, { fromCache, hasPendingWrites })
export async function watchState(uid, cb, onError) {
  const { db, f } = await ensureFirebase();
  const ref = f.doc(db, 'users', uid, 'state', 'main');
  return f.onSnapshot(
    ref,
    { includeMetadataChanges: false },
    (snap) => cb(snap.exists() ? snap.data() : null, { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites }),
    (err) => onError && onError(err)
  );
}

export async function pushState(uid, payload) {
  const { db, f } = await ensureFirebase();
  const ref = f.doc(db, 'users', uid, 'state', 'main');
  await f.setDoc(ref, payload);
}
