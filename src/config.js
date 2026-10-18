// Cấu hình chung của app
export const APP_NAME = 'Mon Money Tracking';
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

// Nơi phát hành bản cập nhật (GitHub Releases của repo public)
export const GITHUB_OWNER = 'satthupc00';
export const GITHUB_REPO = 'Money_Tracking';

// Firebase web config (apiKey của Firebase web không phải bí mật, dữ liệu được bảo vệ bằng Rules + đăng nhập)
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBHcwbEjS044NmYEsOJtKevtZ4wiym8bwY',
  authDomain: 'money-tracking-bf29e.firebaseapp.com',
  projectId: 'money-tracking-bf29e',
  storageBucket: 'money-tracking-bf29e.firebasestorage.app',
  messagingSenderId: '131881148193',
  appId: '1:131881148193:web:9ebef1df55de97897ca860',
};
