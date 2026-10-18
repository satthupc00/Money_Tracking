# Firebase – Rules cho Mon Money Tracking

App dùng **Firestore Database** + **Authentication (Email/Password)**.
Mỗi tài khoản chỉ đọc/ghi được dữ liệu của chính mình tại `users/{uid}/...`.

## Firestore → tab Rules → dán đè toàn bộ rồi bấm Publish

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Dữ liệu riêng của từng tài khoản
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Chặn mọi thứ khác
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Các bước tạo nhanh
1. Vào https://console.firebase.google.com → **Add project** → đặt tên (vd `mon-money-tracking`), có thể tắt Google Analytics.
2. **Build → Authentication → Get started → Email/Password → Enable** (chỉ bật dòng đầu).
3. **Authentication → Users → Add user**: tạo 1 tài khoản email + mật khẩu của bạn (dùng chung cho PC và điện thoại).
4. **Build → Firestore Database → Create database** → chọn vùng `asia-southeast1` (Singapore) → Production mode.
5. Tab **Rules** → dán đoạn rule ở trên → **Publish**.
6. **Project settings (bánh răng) → General → Your apps → biểu tượng `</>` (Web)** → đặt tên → Register.
   Copy đoạn `firebaseConfig = { apiKey: ..., authDomain: ..., projectId: ..., ... }` gửi lại cho Claude.

> `apiKey` của Firebase web không phải mật khẩu bí mật — dữ liệu được bảo vệ bởi rule ở trên + đăng nhập.
