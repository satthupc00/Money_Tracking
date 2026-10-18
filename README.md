# Mon Money Tracking

Theo dõi tổng tài sản theo tháng. Chạy trên **điện thoại Android** (tối ưu Galaxy Z Fold 7) và **PC Windows**, dữ liệu tự đồng bộ giữa các máy.

## Cài đặt
Vào trang **Releases** của repo, tải bản mới nhất:
- Điện thoại: `MonMoneyTracking-x.y.z.apk`
- PC: `MonMoneyTracking-Setup-x.y.z.exe`

Từ lần sau app tự báo khi có bản mới, bấm **Cập nhật** là xong.

## Lần đầu mở app
1. Điện thoại: tạo **mã PIN** (4–10 số), các lần sau mở bằng **vân tay**. PC: đặt **mật khẩu** (nhập tự do, phân biệt hoa thường).
2. Bấm **chấm tròn** ở góc phải trên → đăng nhập email để đồng bộ. Dùng cùng 1 tài khoản trên điện thoại và PC.
3. Có file sao lưu cũ? **Cài đặt → Nhập file**.

## Thiết lập 1 lần cho việc tự build và phát hành
Vào repo trên GitHub → **Settings → Secrets and variables → Actions → New repository secret**, tạo 2 secret:

| Tên | Giá trị |
|---|---|
| `ANDROID_KEYSTORE_B64` | nội dung file `ANDROID_KEYSTORE_B64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | nội dung file `ANDROID_KEYSTORE_PASSWORD.txt` |

Hai secret này là khoá ký APK, giúp bản cập nhật cài đè lên bản cũ mà không mất dữ liệu. Không chia sẻ cho ai.

Repo phải để **Public** thì app mới tự đọc được bản cập nhật.

## Phát hành bản mới
1. Tăng `version` trong `package.json` (vd `2.0.0` → `2.0.1`).
2. Thêm mục `## v2.0.1` vào `RELEASE_NOTES.md`. Nội dung mục này sẽ thành bảng thông báo.
3. Đẩy lên nhánh `main`. GitHub Actions tự build APK + bộ cài Windows rồi tạo Release.

## Đồng bộ (Firebase)
Rules của Firestore nằm trong [FIREBASE_RULES.md](FIREBASE_RULES.md).

## Dành cho người lập trình
```
npm install
npm run dev            # chạy thử trên trình duyệt (số liệu mẫu, không đồng bộ)
npm run electron:dev   # chạy bản PC
npm run dist:win       # build bộ cài Windows
npm run preview:html   # build 1 file HTML xem thử
npx cap sync android   # rồi mở thư mục android bằng Android Studio để build APK
```

Created by Mondiro
