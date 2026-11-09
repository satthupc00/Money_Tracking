# Bảng thông báo cập nhật - Mon Money Tracking

Mỗi bản phát hành có 1 mục `## vX.Y.Z` bên dưới. Khi đẩy lên nhánh main, nội dung mục đúng phiên bản sẽ thành bảng thông báo trên GitHub Releases.

## v2.3.2

**Bảng nhập gọn gàng hơn + vạch sổ tiết kiệm dễ đọc.**

- Khi mở bảng Nhập nhanh hoặc bảng nhập Sổ tiết kiệm: không bấm nhầm được phần phía dưới nữa, chạm ra ngoài không làm mất số đang nhập. Bấm phím Back (Android) hoặc Esc (PC) để đóng.
- Phím Back cũng đóng các hộp thoại khác (cài đặt, sửa số…).
- Biểu đồ: mỗi sổ tiết kiệm 1 màu riêng, chữ xoay dọc nằm bên trái vạch, chỉ ghi tên sổ và tiền lãi (+20tr).
- Tab Tiết kiệm: nút + nhập nhanh tạm tắt; nút "Thêm sổ tiết kiệm" luôn cố định ở dưới cùng, không bị cuộn mất.

## v2.3.1

**Sổ tiết kiệm: nhập ngày đáo hạn + kỳ hạn, tự ra ngày mở sổ.**

- Ô nhập mới: Ngày kết thúc (đáo hạn) + Kỳ hạn (tháng) — ngày mở sổ tự tính bằng ngày kết thúc lùi lại số tháng đó.
- Nút chọn nhanh 1/3/6/12/24 tháng; vẫn sửa tay được ngày mở sổ nếu cần.

## v2.3.0

**Mục mới: Sổ tiết kiệm.**

- Thêm các sổ tiết kiệm đang có: tên sổ, số tiền gửi, ngày bắt đầu, ngày kết thúc, lãi suất (có nút chọn nhanh kỳ hạn 1/3/6/12/24 tháng).
- Tự tính tổng tiền lãi, lãi trung bình 1 ngày, số tiền nhận khi đáo hạn và lãi đã có đến hôm nay (lãi đơn, số ngày thực tế / 365).
- Thẻ tổng: tổng tiền đang gửi, tổng lãi sẽ nhận, lãi trung bình mỗi ngày của tất cả sổ.
- Biểu đồ có vạch đỏ nét đứt tại ngày đáo hạn của mỗi sổ, ghi tên sổ + số tiền + tiền lãi.
- Điện thoại: tab "Tiết kiệm" ở thanh dưới (Cài đặt ở biểu tượng bánh răng góc trên). PC: nút "Sổ tiết kiệm" trên header.
- Sổ tiết kiệm được đồng bộ giữa các máy và có trong file sao lưu.

## v2.2.2

**Quan trọng – bản Android này là app MỚI**
- App đã được đăng ký chính chủ với Google (Android Developer Console) để không còn bị Play Protect chặn khi cập nhật.
- Vì vậy app đổi sang mã app mới `com.mondiro.moneytracking`, **không cài đè lên bản cũ được** (khoá ký giữ nguyên).
- Cách lên đời: sao lưu / đồng bộ dữ liệu trên bản cũ → cài `MonMoneyTracking-2.2.2.apk` → kiểm tra → gỡ bản cũ.
- Từ bản này trở đi, cập nhật sẽ cài đè bình thường.

## v2.2.1

**Sửa lỗi hỏi vân tay liên tục.**

- Hộp thoại vân tay chỉ tự bật 1 lần mỗi khi mở / quay lại app. Nếu bạn huỷ, app không tự hỏi lại nữa — chạm nút vân tay để thử lại hoặc chọn "Dùng mã PIN".
- Mở hộp thoại vân tay không còn bị tính là "rời app" (trước đây làm app tự khoá lại và hỏi vân tay lặp vô hạn).

## v2.2.0

**Mục Chi tiết thiết kế lại cho điện thoại.**

- Công tắc **Theo tháng | Theo mục** ở đầu mục Chi tiết (app nhớ lựa chọn của bạn).
- Theo tháng: mỗi tháng 1 thẻ có tổng, tăng/giảm so tháng trước và thanh màu cơ cấu; chạm để mở danh sách mục, bấm vào mục để sửa. Có nút "Nhập cả tháng" ngay trong thẻ.
- Theo mục: mỗi mục có số hiện tại, thay đổi so tháng trước và biểu đồ nhỏ 12 tháng; chạm để mở lưới 12 tháng ô to và sửa từng tháng.
- Màn trong Z Fold 7: thêm tab Chi tiết trên thanh bên, danh sách bên trái và chi tiết bên phải.
- Bản PC giữ nguyên bảng đầy đủ 12 tháng.

## v2.1.1

**Mở khoá bằng vân tay khi quay lại app.**

- Mỗi lần mở lại / quay lại app, điện thoại hiện màn vân tay và tự bật cảm biến, không hiện bàn phím PIN nữa.
- Mã PIN vẫn còn làm phương án dự phòng (nút "Dùng mã PIN") khi vân tay không nhận.

## v2.1.0

**Logo mới + biểu đồ cột.**

- Logo mới: 3 cột tăng trưởng và tia sét đỏ (icon PC, Android, header, màn khoá).
- Biểu đồ có 3 kiểu xem, đổi bằng nút ở góc thẻ biểu đồ: Đường, Cột, Cột chồng theo mục.
- Kiểu Cột chồng: mỗi cột chia màu theo từng mục, có chú thích màu; chạm vào cột để xem số tiền từng mục của tháng đó.
- App nhớ kiểu biểu đồ bạn chọn.

## v2.0.1

**Icon mới.**

- Icon app mới: chiếc ví nhỏ ôm đồng xu, có mầm cây trên đầu (Android, PC và trong app).
- Icon Android hỗ trợ biểu tượng theo chủ đề (themed icon) và nền kem nhạt.

## v2.0.0

**Bản lớn: giao diện mới, chạy trên cả PC và điện thoại, đồng bộ dữ liệu.**

- Giao diện mới theo phong cách Mondiro (tối, nhấn đỏ), tối ưu cho Galaxy Z Fold 7: màn ngoài 1 cột + thanh tab dưới, màn trong 2 cột.
- Có bản PC (Windows): header kéo được cửa sổ, sidebar tổng quan, sửa số trực tiếp trong bảng như Excel (Enter/Tab để nhảy ô), zoom biểu đồ bằng con lăn chuột.
- Đồng bộ dữ liệu giữa PC và điện thoại qua tài khoản email (chấm tròn góc phải trên báo trạng thái).
- Mở app: điện thoại hỏi mã PIN rồi mở bằng vân tay; PC dùng mật khẩu dài nhập tự do. Mã PIN/mật khẩu chỉ lưu dạng mã hoá trên máy.
- Mới: so sánh với tháng trước và cùng kỳ năm ngoái, mục tiêu tài sản kèm dự đoán ngày đạt, tab Cơ cấu tài sản (biểu đồ tròn + biểu đồ riêng từng mục), nhập nhanh số dư cả tháng, nút ẩn số tiền.
- Tự khoá khi rời app: chọn Ngay / 1 / 5 / 15 phút / Không.
- Tự kiểm tra và cài bản cập nhật mới (nút mũi tên xoay, hiện "latest" khi đã là bản mới nhất).
