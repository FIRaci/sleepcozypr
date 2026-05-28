# The Cozy Web 🌙

**Không gian thư giãn & giấc ngủ an lành — nơi công nghệ giao thoa cùng sự bình yên.**

The Cozy Web là một ứng dụng web tĩnh (single-page application) được xây dựng với mục tiêu mang lại sự thư giãn, cải thiện chất lượng giấc ngủ và tối ưu hiệu suất làm việc. Tích hợp đồng hồ báo thức thông minh, kỹ thuật Pomodoro, âm thanh nền, bài tập thở, và trợ lý AI — tất cả trong một không gian giao diện ấm áp, tự động chuyển đổi theo thời gian thực.

> ⚡ **Công nghệ:** HTML thuần + CSS + JavaScript (vanilla) — không framework, không build tool.  
> 🌐 **Đa ngôn ngữ:** Tiếng Việt, English, 日本語.  
> 🎯 **Chạy hoàn toàn ở trình duyệt** — không cần backend, không cần tài khoản.

---

## ✨ Tính năng nổi bật

### 🧠 Trợ lý AI thông minh
Tự động đặt lịch báo thức từ mô tả lịch trình bằng ngôn ngữ tự nhiên. Hỗ trợ Gemini API và các API tương thích.

### 🎵 Thư viện âm thanh
Tạo bộ sưu tập âm thanh riêng: âm thanh mặc định (mưa, suối, hồ, gió, lửa trại, sóng biển), tải lên file nhạc, hoặc nhúng link YouTube.

### 🌤️ Vòng tuần hoàn ngày-đêm
Không gian tự động thay đổi theo thời gian thực: bình minh → ban ngày → hoàng hôn → màn đêm, với hiệu ứng mặt trời, mặt trăng, sao, mây, mưa, tuyết, sương mù.

### ⏱️ Đồng hồ báo thức & Lịch trình
Đặt báo thức với tên gọi, âm thanh tùy chỉnh, lặp lại hàng ngày. Quản lý danh sách báo thức đã lưu.

### 🍅 Kỹ thuật Pomodoro
Tập trung làm việc với Pomodoro (25 phút), nghỉ ngắn (5 phút), nghỉ dài (15 phút). Nhận gợi ý thư giãn sau mỗi phiên.

### 🧘 Bài tập thở (Chill & Heal)
Bài tập thở 4-7-8 với vòng tròn animation, giúp thư giãn tức thì.

### 🎨 Thư viện giao diện
5 chủ đề màu sắc: Tự động theo giờ, Đêm Tĩnh Lặng, Hoàng Hôn Ấm Áp, Bình Minh Dịu Êm, Ngày Biển Xanh.

### 📊 Thống kê cá nhân
Theo dõi tổng thời gian thư giãn, số lần ghé thăm, âm thanh yêu thích — lưu trữ qua IndexedDB.

### 💡 Mẹo ngủ khoa học
10 mẹo ngủ được chọn lọc, hiển thị ngẫu nhiên mỗi khi báo thức đổ.

---

## 🚀 Triển khai

Dự án là **static site** thuần — có thể deploy lên bất kỳ nền tảng hosting tĩnh nào:

```bash
# GitHub Pages
git push origin main

# Netlify / Vercel
# Chỉ cần trỏ thư mục gốc của dự án
```

### Yêu cầu
- Trình duyệt hiện đại (Chrome, Firefox, Edge, Safari)
- Kết nối Internet (cho CDN: Tailwind, Swiper, Dexie, Font Awesome, YouTube IFrame)

### Không yêu cầu
- ❌ Backend server
- ❌ Database
- ❌ API key (tùy chọn cho AI Assistant)
- ❌ Đăng ký tài khoản

---

## 📁 Cấu trúc thư mục

```
thecozy/
├── index.html          # Giao diện chính (250 dòng)
├── style.css           # Định nghĩa giao diện (632 dòng)
├── script.js           # Logic ứng dụng (~1200 dòng)
├── translation.js      # Đa ngôn ngữ EN / VI / JA (455 dòng)
├── README.md           # Bạn đang đọc nó
└── legacy-current/     # Bản sao lưu phiên bản cũ
```

---

## 🛠️ Công nghệ sử dụng

| Công nghệ | Mục đích |
|-----------|----------|
| HTML5 + CSS3 | Cấu trúc & giao diện |
| JavaScript (Vanilla) | Toàn bộ logic ứng dụng |
| [Tailwind CSS](https://tailwindcss.com/) (CDN) | Utility classes |
| [Swiper.js](https://swiperjs.com/) v11 | Sidebar dạng slide |
| [Dexie.js](https://dexie.org/) v3 | IndexedDB wrapper |
| [Font Awesome](https://fontawesome.com/) 6.4 | Icon |
| [Google Fonts](https://fonts.google.com/) (Quicksand) | Typography |
| YouTube IFrame API | Phát nhạc từ YouTube |

---

## 🌐 Đa ngôn ngữ

Ứng dụng hỗ trợ 3 ngôn ngữ, chuyển đổi tức thì qua dropdown:

- **VI** — Tiếng Việt (mặc định)
- **EN** — English
- **JA** — 日本語

---

## 👤 Tác giả

Dự án được phát triển bởi **FIRaci**.

> *"Mỗi dòng code đều mang một chút bình yên."*

---

## 📄 Giấy phép

Dự án mã nguồn mở. Vui lòng ghi nhận tác giả khi sử dụng lại.
