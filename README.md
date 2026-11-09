# Mini Capital – Văn phòng AI nghiên cứu & quản lý cổ phiếu

Văn phòng isometric nơi 4 nhân viên AI (CrewAI) làm việc thật cho khách hàng:
**Chuyên viên phân tích → Chuyên viên định lượng → Quản trị rủi ro → Giám đốc đầu tư** (ký báo cáo).
Mọi chuyển động trong văn phòng phản ánh tiến độ thật của các agent.

> ⚠️ Báo cáo do AI tạo, chỉ mang tính tham khảo – không phải tư vấn đầu tư. AI không có dữ liệu thị trường thời gian thực.

## Xem thử trên GitHub Pages

**https://tinnguyentcb.github.io/ai-mini-office/**

GitHub Pages chỉ chạy được phần giao diện, nên bản này là **bản xem thử**: có đủ văn phòng, màn chào, Đơn cam kết,
sắp xếp nội thất; nút “Giao việc” chạy **mô phỏng** với dữ liệu hư cấu (không gọi AI).

## Chạy đầy đủ trên máy (có AI thật)

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Tạo file `.env` (không bao giờ đưa file này lên GitHub):

```
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

Chạy rồi mở http://localhost:8000 :

```powershell
uvicorn main:app --reload --port 8000
```

## Cấu trúc

| File | Vai trò |
|---|---|
| `main.py` | Backend FastAPI + CrewAI, phát trạng thái qua WebSocket |
| `static/js/sim.js` | Mô phỏng nhân viên: đi lại, làm việc, giải lao, bàn giao |
| `static/js/characters.js` | Nhân vật pixel 8 hướng |
| `static/js/furniture.js` | Nội thất dựng khối 3D, xoay được |
| `static/js/pathfinding.js` | Tìm đường A* né đồ đạc |
| `static/js/dialogue.js` | Lời thoại theo từng vị trí |
| `static/js/onboarding.js` | Màn chào + Đơn cam kết (ký tên, đóng mộc) |
| `static/js/demo.js` | Chế độ mô phỏng không tốn API |
