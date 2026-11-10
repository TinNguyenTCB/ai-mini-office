// Đa ngôn ngữ: Tiếng Việt (mặc định), English, 日本語.
// t("key", { name }) trả về chuỗi theo ngôn ngữ hiện tại (thiếu thì rơi về tiếng Việt).
// Phần tử HTML gắn data-i18n / data-i18n-html / data-i18n-placeholder / data-i18n-title / data-i18n-aria-label
// được applyI18n() tự cập nhật.

export const LANGS = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
];
const LANG_KEY = "ai-office-lang";

const pad = n => String(n).padStart(2, "0");

const DICT = {
  vi: {
    "doc.title": "Mini Capital – Văn phòng đầu tư AI",
    "brand.tagline": "Văn phòng AI nghiên cứu & quản lý cổ phiếu",
    "common.loading": "Đang tải…",
    "a11y.openMenu": "Mở menu", "a11y.collapse": "Thu gọn", "a11y.openReport": "Mở báo cáo", "a11y.openTeam": "Mở đội ngũ",
    "a11y.office": "Văn phòng Mini Capital", "a11y.task": "Giao nhiệm vụ",
    "conn.connecting": "Đang kết nối…", "conn.on": "Đã kết nối", "conn.off": "Mất kết nối", "conn.preview": "Bản xem thử", "conn.title": "Kết nối backend",

    "menu.title": "Menu", "menu.close": "Đóng menu",
    "menu.language": "Ngôn ngữ",
    "menu.ai": "Cài đặt AI", "menu.leaderModel": "Giám đốc đầu tư", "menu.teamModel": "Đội phân tích (3 chuyên viên)",
    "menu.modelHint": "Model thiếu API key trong <code>.env</code> sẽ bị khoá.",
    "menu.client": "Khách hàng", "menu.furniture": "Nội thất",
    "menu.display": "Hiển thị & thử nghiệm", "menu.showReport": "Khung báo cáo (trái)", "menu.showSide": "Đội ngũ & nhật ký (phải)",
    "menu.runDemo": "Chạy mô phỏng (không tốn API)", "menu.replayIntro": "Xem lại màn chào",

    "models.noKey": "(thiếu API key)", "models.offline": "Không có máy chủ AI – chế độ mô phỏng",

    "client.unsigned": "Chưa ký đơn cam kết.", "client.viewPledge": "Xem đơn cam kết", "client.resign": "Ký lại tên khác",
    "client.badge": "Quý khách {name}", "client.info": "Quý khách {name} · ký ngày {date} · {no}",
    "client.address": "Quý khách {name}", "client.guest": "Khách",

    "furn.enable": "Bật chế độ sắp xếp", "furn.done": "Xong sắp xếp",
    "furn.help": "Chọn món rồi bấm lên sàn để đặt. Kéo để di chuyển · <kbd>R</kbd> xoay · <kbd>Del</kbd> xoá · <kbd>Esc</kbd> huỷ.",
    "furn.count": "({n} món)", "furn.none": "Chưa chọn món nào.",
    "furn.selected": "{label} · hướng {deg}°", "furn.ready": "Sẵn sàng đặt: {label} · hướng {deg}°",
    "furn.seatedLabel": "Người ngồi bàn này", "furn.emptyDesk": "— Bàn trống —", "furn.emptyLabel": "Bàn trống",
    "furn.rotate": "Xoay 90°", "furn.delete": "Xoá", "furn.reset": "Mặc định", "furn.confirm": "Bấm lần nữa để xác nhận",
    "furn.cantPlace": "Không đặt được ở đây: chồng lên đồ khác hoặc ra ngoài phòng.",
    "furn.shiftHint": "Giữ Shift để đặt tiếp món tương tự.", "furn.placed": "Đã đặt {label}. Kéo để di chuyển, R để xoay.",
    "furn.cantRotate": "Không xoay được: sẽ chạm đồ khác hoặc tường.", "furn.deleted": "Đã xoá {label}.",
    "furn.restored": "Đã khôi phục bố trí mặc định.", "furn.placing": "Đang đặt {label}: bấm lên sàn (R để xoay, Shift để đặt nhiều).",
    "furn.cancelPlace": "Đã huỷ đặt đồ.", "furn.assigned": "{title} sẽ ngồi ở bàn này.", "furn.unassigned": "Bàn đã trống.",
    "furn.storageFail": "Không lưu được bố trí trên trình duyệt này (localStorage bị chặn).",
    "furn.warn.noDesk": "{title} chưa có bàn – sẽ đứng chờ ở khu trống.", "furn.warn.blocked": "Ghế của {title} đang bị chặn lối đi.",
    "furn.warn.noWhiteboard": "Không có bảng trắng: Giám đốc sẽ lập kế hoạch tại bàn.",
    "furn.warn.noBookshelf": "Không có kệ sách: Chuyên viên phân tích sẽ tra cứu tại bàn.",
    "furn.warn.noPrinter": "Không có máy in: Quản trị rủi ro sẽ nộp báo cáo trực tiếp.",
    "furn.warn.noCabinet": "Không có tủ hồ sơ: báo cáo vẫn lưu được nhưng Giám đốc không có chỗ cất.", "furn.warn.noTrash": "Không có thùng rác: Giám đốc sẽ bỏ túi giấy vo.",
    "furn.item.desk": "Bàn làm việc", "furn.item.meeting": "Bàn họp", "furn.item.bookshelf": "Kệ sách", "furn.item.whiteboard": "Bảng trắng",
    "furn.item.printer": "Máy in", "furn.item.watercooler": "Cây nước", "furn.item.vending": "Máy bán nước", "furn.item.sofa": "Sofa",
    "furn.item.plant": "Cây cảnh", "furn.item.chair": "Ghế",
    "furn.item.cabinet": "Tủ hồ sơ", "furn.item.trash": "Thùng rác",

    "report.title": "Báo cáo đầu tư", "report.copy": "Sao chép", "report.copied": "Đã chép", "report.copyFail": "Không chép được",
    "report.placeholder": "Báo cáo sẽ xuất hiện ở đây sau khi Giám đốc đầu tư thẩm định và ký duyệt.",
    "report.meta": "Gửi: {client} · {time} · {models} · {secs}s", "report.demoTag": "MÔ PHỎNG",
    "report.fromServer": "Báo cáo gần nhất trên máy chủ", "report.failed": "Nhiệm vụ thất bại:\n{error}",
    "report.expand": "Phóng to toàn màn hình", "report.shrink": "Thu nhỏ lại", "report.save": "Lưu vào tủ hồ sơ", "report.saved": "Đã lưu trong tủ", "report.delete": "Xoá", "report.confirmDelete": "Bấm lần nữa để xoá", "report.toastSaved": "Đã cất báo cáo vào tủ hồ sơ", "log.filed": "Đã cất vào tủ hồ sơ: {title}", "report.toastDeleted": "Đã xoá báo cáo", "report.untitled": "Báo cáo không tên", "report.fromArchive": "Từ tủ hồ sơ · lưu lúc {time}", "cabinet.title": "Tủ hồ sơ", "cabinet.open": "Mở tủ hồ sơ", "cabinet.close": "Đóng", "cabinet.count": "{n}/{max} báo cáo đã lưu", "cabinet.empty": "Tủ hồ sơ đang trống. Bấm “Lưu vào tủ hồ sơ” bên dưới báo cáo để cất lại.", "cabinet.view": "Xem", "cabinet.delete": "Xoá", "cabinet.confirm": "Chắc chưa?", "cabinet.current": "Đang mở", "cabinet.full": "Tủ hồ sơ đã đầy ({n} báo cáo). Hãy xoá bớt trước khi lưu thêm.", "cabinet.storageFail": "Trình duyệt không cho lưu thêm (bộ nhớ đầy hoặc chế độ ẩn danh).", "cabinet.hint": "Mẹo: bấm vào tủ hồ sơ cạnh bàn Giám đốc để mở tủ.",
    "team.title": "Đội ngũ", "log.title": "Nhật ký hoạt động",
    "team.status.idle": "Rảnh", "team.status.thinking": "Lập kế hoạch", "team.status.working": "Đang làm",
    "team.status.reviewing": "Viết báo cáo", "team.status.done": "Xong", "team.status.error": "Lỗi",

    "zoom.group": "Thu phóng văn phòng", "zoom.out": "Thu nhỏ ( - )", "zoom.in": "Phóng to ( + )", "zoom.reset": "Về mặc định ( 0 hoặc nhấp đúp )",

    "task.placeholder": "Ví dụ: Phân tích cổ phiếu ngân hàng, tôi có 100 triệu, muốn đầu tư dài hạn 3 năm, chấp nhận rủi ro trung bình.",
    "task.send": "Giao việc", "task.sendDemo": "Giao việc (mô phỏng)", "task.busy": "Đang làm…", "task.sending": "Đang gửi…",
    "task.needPledge": "Vui lòng ký Đơn cam kết trước",
    "task.hint": "Ctrl + Enter để gửi · Lăn chuột để phóng to, kéo để di chuyển, nhấp đúp để về mặc định · Báo cáo do AI tạo, chỉ mang tính tham khảo.",

    "status.connecting": "Đang kết nối backend…", "status.connected": "Đã kết nối.", "status.ready": "Sẵn sàng phục vụ {client}.",
    "status.offline": "Bản xem thử trên GitHub Pages – chưa có máy chủ AI. “Giao việc” sẽ chạy mô phỏng với dữ liệu hư cấu.",
    "status.busy": "Văn phòng đang xử lý một nhiệm vụ.", "status.accepted": "Đã nhận nhiệm vụ: {prompt}",
    "status.done": "Hoàn thành! Báo cáo đầu tư ở khung bên trái.", "status.error": "Lỗi: {error}",
    "status.disconnected": "Mất kết nối backend – thử lại sau {s} giây… (vẫn có thể chạy mô phỏng trong menu ☰)",
    "status.noKeys": "Chưa có API key nào trong .env – thêm key rồi khởi động lại backend.",
    "status.modelsFail": "Không tải được danh sách model: {error}",
    "status.needPledge": "Quý khách cần ký Đơn cam kết trước khi giao việc.", "status.emptyPrompt": "Hãy nhập yêu cầu cho văn phòng trước đã.",
    "status.rejected": "Không giao được việc: {detail}", "status.sendFail": "Không gửi được tới backend: {error}",

    "toast.demo": "Đang chạy mô phỏng – không gọi API, dữ liệu hư cấu",
    "toast.demoOffline": "Bản xem thử: chạy mô phỏng – không gọi AI, dữ liệu hư cấu",
    "toast.signed": "Đã ký cam kết – chào mừng {client}!", "toast.welcomeBack": "Chào mừng {client} quay lại!",
    "toast.resigned": "Văn phòng sẽ làm việc với {client}",

    "log.open": "Văn phòng mở cửa.", "log.handoff": "{from} → {to}: bàn giao{msg}", "log.newJob": "Nhiệm vụ mới: {prompt}",
    "log.approved": "Giám đốc đầu tư đã ký duyệt báo cáo.", "log.failed": "Nhiệm vụ thất bại: {error}",
    "log.signed": "{client} đã ký Đơn cam kết ({no}).",

    "greet.ohGuest": "Ồ, có khách!", "greet.hello": "Xin chào! Chào mừng Quý khách đến với Mini Capital.",
    "greet.intro": "Tôi là Giám đốc đầu tư. Đội ngũ AI của chúng tôi nghiên cứu cổ phiếu theo yêu cầu của Quý khách.",
    "greet.pledge": "Trước khi bắt đầu, mời Quý khách đọc và ký Đơn cam kết.", "greet.readTerms": "Mời Quý khách xem kỹ các điều khoản…",
    "greet.thanks": "Cảm ơn {client}! Rất hân hạnh được đồng hành cùng Quý khách.", "greet.giveTask": "Mời Quý khách giao nhiệm vụ ở khung phía dưới.",
    "greet.welcomeBack": "Chào mừng {client} quay lại!", "greet.reportReady": "Báo cáo đã sẵn sàng, mời {client} xem.",
    "greet.reportReadyAnon": "Báo cáo đã sẵn sàng!", "greet.resigned": "Rất vui được làm việc với {client}!",

    "intro.tag": "Văn phòng AI nghiên cứu & quản lý cổ phiếu", "intro.hello": "Xin chào, chào mừng Quý khách!",
    "intro.chooseLang": "Chọn ngôn ngữ", "intro.enter": "Vào văn phòng",

    "pledge.title": "ĐƠN CAM KẾT SỬ DỤNG DỊCH VỤ", "pledge.lead": "Tôi, người ký tên dưới đây, xác nhận đã đọc và hiểu rõ:",
    "pledge.t1": "Toàn bộ nhân viên của Mini Capital là <strong>trợ lý AI</strong> (mô hình ngôn ngữ), không phải chuyên gia tài chính được cấp phép.",
    "pledge.t2": "Báo cáo chỉ mang tính <strong>tham khảo</strong>, không phải lời khuyên đầu tư và không phải lời mời mua/bán chứng khoán.",
    "pledge.t3": "AI <strong>không có dữ liệu thị trường thời gian thực</strong>; số liệu có thể lỗi thời, sai lệch hoặc bị AI suy diễn. Tôi sẽ tự kiểm chứng với nguồn chính thống trước khi quyết định.",
    "pledge.t4": "Đầu tư cổ phiếu có rủi ro mất vốn. Tôi <strong>tự chịu trách nhiệm</strong> hoàn toàn với các quyết định đầu tư của mình.",
    "pledge.t5": "Tôi không nhập thông tin nhạy cảm (mật khẩu, số tài khoản, giấy tờ tuỳ thân…). Nội dung yêu cầu sẽ được gửi tới nhà cung cấp AI đã chọn để xử lý.",
    "pledge.t6": "Tên của tôi chỉ được lưu trên trình duyệt này để văn phòng xưng hô.",
    "pledge.nameLabel": "Họ và tên khách hàng", "pledge.namePlaceholder": "Nhập họ và tên của Quý khách",
    "pledge.agree": "Tôi đã đọc, hiểu và đồng ý với các điều trên.",
    "pledge.clientLabel": "KHÁCH HÀNG", "pledge.clientSub": "(ký, ghi rõ họ tên)",
    "pledge.officeLabel": "ĐẠI DIỆN MINI CAPITAL", "pledge.officeSub": "Giám đốc đầu tư (AI)", "pledge.officeSign": "Giám đốc AI",
    "pledge.stampRing": "MINI CAPITAL ✦ VĂN PHÒNG ĐẦU TƯ AI ✦", "pledge.stampCenter": "ĐÃ DUYỆT",
    "pledge.submit": "Ký tên & đóng dấu", "pledge.close": "Đóng", "pledge.cancel": "Huỷ",
    "pledge.errName": "Vui lòng nhập họ và tên (ít nhất 2 ký tự).", "pledge.errAgree": "Quý khách cần đánh dấu đồng ý trước khi ký.",
    "pledge.no": "Số:",
    "pledge.date": d => `Ngày ${pad(d.getDate())} tháng ${pad(d.getMonth() + 1)} năm ${d.getFullYear()}`,

    "wall.market": "THỊ TRƯỜNG · minh hoạ", "wall.tagline": "Nghiên cứu & quản lý cổ phiếu",
    "sim.getWater": "Đi lấy nước", "sim.findDocs": "Tìm tài liệu", "sim.toWindow": "Ra cửa sổ", "sim.sitRest": "Ngồi nghỉ chút",
    "sim.goChat": "Ra trò chuyện chút", "sim.planInvest": "Lập kế hoạch đầu tư", "sim.assign": "Phân công nhiệm vụ",
    "sim.findReports": "Tìm báo cáo tài chính", "sim.readAnnual": "Đọc báo cáo thường niên", "sim.print": "In báo cáo", "sim.printing": "Đang in…",
    "sim.handoffTo": "Bàn giao cho {name}", "sim.handoffDefault": "Phần của mình xong rồi nhé!", "sim.done": "Xong phần việc ✔",
    "sim.thinking": "💭 Đang suy nghĩ…", "sim.writing": "Đang viết…",
    "printer.title": "Máy in", "printer.open": "Mở máy in", "printer.count": "{n} hồ sơ trong tủ · đã chọn {k}", "printer.empty": "Tủ hồ sơ đang trống. Hãy lưu báo cáo vào tủ trước khi in.", "printer.all": "Chọn tất cả", "printer.none": "Bỏ chọn", "printer.go": "In {k} hồ sơ", "printer.pick": "Chọn hồ sơ để in", "printer.hint": "Mẹo: bấm vào máy in trong văn phòng để mở danh sách in.", "printer.toast": "Giám đốc đang in {k} hồ sơ…", "printer.busy": "Máy in đang chạy, đợi chút nhé.", "print.kind": "Báo cáo nghiên cứu đầu tư", "print.client": "Khách hàng", "print.saved": "Lưu lúc", "print.printed": "In lúc", "print.info": "Thông tin", "print.footer": "Báo cáo do đội AI của Mini Capital soạn, chỉ mang tính tham khảo, không phải lời khuyên đầu tư.", "sim.toPrinter": "Ra máy in", "sim.printDone": "In xong rồi! 🖨️", "log.printed": "Đã in: {title}",
    "sim.toCabinet": "Cất vào tủ hồ sơ", "sim.filing": "🗂️ Lưu hồ sơ cẩn thận…", "sim.trashSay": "Bản này không cần nữa rồi…", "sim.crumple": "*sột soạt* 🤏", "sim.score": "Vào! 🗑️ Gọn gàng.", "sim.pocket": "Để lát bỏ thùng rác vậy.",
  },

  en: {
    "doc.title": "Mini Capital – AI Investment Office",
    "brand.tagline": "AI stock research & portfolio office",
    "common.loading": "Loading…",
    "a11y.openMenu": "Open menu", "a11y.collapse": "Collapse", "a11y.openReport": "Open report", "a11y.openTeam": "Open team",
    "a11y.office": "Mini Capital office", "a11y.task": "Assign a task",
    "conn.connecting": "Connecting…", "conn.on": "Connected", "conn.off": "Disconnected", "conn.preview": "Preview", "conn.title": "Backend connection",

    "menu.title": "Menu", "menu.close": "Close menu",
    "menu.language": "Language",
    "menu.ai": "AI settings", "menu.leaderModel": "Chief Investment Officer", "menu.teamModel": "Research team (3 analysts)",
    "menu.modelHint": "Models without an API key in <code>.env</code> are locked.",
    "menu.client": "Client", "menu.furniture": "Furniture",
    "menu.display": "Display & testing", "menu.showReport": "Report panel (left)", "menu.showSide": "Team & activity log (right)",
    "menu.runDemo": "Run simulation (no API cost)", "menu.replayIntro": "Replay welcome",

    "models.noKey": "(no API key)", "models.offline": "No AI server – simulation mode",

    "client.unsigned": "Commitment form not signed yet.", "client.viewPledge": "View commitment form", "client.resign": "Sign with another name",
    "client.badge": "{name}", "client.info": "{name} · signed {date} · {no}",
    "client.address": "{name}", "client.guest": "Guest",

    "furn.enable": "Enable arrange mode", "furn.done": "Done arranging",
    "furn.help": "Pick an item, then click the floor to place it. Drag to move · <kbd>R</kbd> rotate · <kbd>Del</kbd> delete · <kbd>Esc</kbd> cancel.",
    "furn.count": "({n} items)", "furn.none": "Nothing selected.",
    "furn.selected": "{label} · facing {deg}°", "furn.ready": "Ready to place: {label} · facing {deg}°",
    "furn.seatedLabel": "Who sits at this desk", "furn.emptyDesk": "— Empty desk —", "furn.emptyLabel": "Empty desk",
    "furn.rotate": "Rotate 90°", "furn.delete": "Delete", "furn.reset": "Default", "furn.confirm": "Click again to confirm",
    "furn.cantPlace": "Can't place here: overlaps another item or is outside the room.",
    "furn.shiftHint": "Hold Shift to keep placing the same item.", "furn.placed": "Placed {label}. Drag to move, R to rotate.",
    "furn.cantRotate": "Can't rotate: it would hit another item or a wall.", "furn.deleted": "Deleted {label}.",
    "furn.restored": "Default layout restored.", "furn.placing": "Placing {label}: click the floor (R to rotate, Shift to place several).",
    "furn.cancelPlace": "Placement cancelled.", "furn.assigned": "{title} will sit at this desk.", "furn.unassigned": "The desk is now empty.",
    "furn.storageFail": "Couldn't save the layout in this browser (localStorage is blocked).",
    "furn.warn.noDesk": "{title} has no desk – will wait in an open area.", "furn.warn.blocked": "{title}'s chair is blocked.",
    "furn.warn.noWhiteboard": "No whiteboard: the CIO will plan at the desk.",
    "furn.warn.noBookshelf": "No bookshelf: the Research Analyst will research at the desk.",
    "furn.warn.noPrinter": "No printer: the Risk Manager will hand in the report directly.",
    "furn.warn.noCabinet": "No filing cabinet: reports can still be saved, but the CIO has nowhere to file them.", "furn.warn.noTrash": "No wastebasket: the CIO will pocket the crumpled paper.",
    "furn.item.desk": "Desk", "furn.item.meeting": "Meeting table", "furn.item.bookshelf": "Bookshelf", "furn.item.whiteboard": "Whiteboard",
    "furn.item.printer": "Printer", "furn.item.watercooler": "Water cooler", "furn.item.vending": "Vending machine", "furn.item.sofa": "Sofa",
    "furn.item.plant": "Plant", "furn.item.chair": "Chair",
    "furn.item.cabinet": "Filing cabinet", "furn.item.trash": "Wastebasket",

    "report.title": "Investment report", "report.copy": "Copy", "report.copied": "Copied", "report.copyFail": "Couldn't copy",
    "report.placeholder": "The report will appear here once the Chief Investment Officer has reviewed and signed it.",
    "report.meta": "To: {client} · {time} · {models} · {secs}s", "report.demoTag": "SIMULATION",
    "report.fromServer": "Latest report on the server", "report.failed": "Task failed:\n{error}",
    "report.expand": "Full screen", "report.shrink": "Exit full screen", "report.save": "Save to cabinet", "report.saved": "Saved in cabinet", "report.delete": "Delete", "report.confirmDelete": "Click again to delete", "report.toastSaved": "Report filed in the cabinet", "log.filed": "Filed in the cabinet: {title}", "report.toastDeleted": "Report deleted", "report.untitled": "Untitled report", "report.fromArchive": "From the filing cabinet · saved {time}", "cabinet.title": "Filing cabinet", "cabinet.open": "Open filing cabinet", "cabinet.close": "Close", "cabinet.count": "{n}/{max} saved reports", "cabinet.empty": "The cabinet is empty. Click “Save to cabinet” under a report to file it.", "cabinet.view": "Open", "cabinet.delete": "Delete", "cabinet.confirm": "Sure?", "cabinet.current": "Showing", "cabinet.full": "The cabinet is full ({n} reports). Delete some before saving more.", "cabinet.storageFail": "The browser refused to store more (storage full or private mode).", "cabinet.hint": "Tip: click the filing cabinet next to the CIO's desk to open it.",
    "team.title": "Team", "log.title": "Activity log",
    "team.status.idle": "Idle", "team.status.thinking": "Planning", "team.status.working": "Working",
    "team.status.reviewing": "Writing report", "team.status.done": "Done", "team.status.error": "Error",

    "zoom.group": "Office zoom", "zoom.out": "Zoom out ( - )", "zoom.in": "Zoom in ( + )", "zoom.reset": "Reset view ( 0 or double-click )",

    "task.placeholder": "e.g. Analyse bank stocks for me: I have $5,000 to invest long term (3 years) with moderate risk.",
    "task.send": "Assign", "task.sendDemo": "Assign (simulation)", "task.busy": "Working…", "task.sending": "Sending…",
    "task.needPledge": "Please sign the commitment form first",
    "task.hint": "Ctrl + Enter to send · Scroll to zoom, drag to pan, double-click to reset · AI-generated reports, for reference only.",

    "status.connecting": "Connecting to the backend…", "status.connected": "Connected.", "status.ready": "Ready to serve you, {client}.",
    "status.offline": "GitHub Pages preview – no AI server. “Assign” runs a simulation with fictional data.",
    "status.busy": "The office is working on a task.", "status.accepted": "Task received: {prompt}",
    "status.done": "Done! The investment report is in the left panel.", "status.error": "Error: {error}",
    "status.disconnected": "Backend disconnected – retrying in {s} s… (you can still run the simulation from the ☰ menu)",
    "status.noKeys": "No API key in .env – add one and restart the backend.",
    "status.modelsFail": "Couldn't load the model list: {error}",
    "status.needPledge": "Please sign the commitment form before assigning a task.", "status.emptyPrompt": "Please type a request for the office first.",
    "status.rejected": "Couldn't assign the task: {detail}", "status.sendFail": "Couldn't reach the backend: {error}",

    "toast.demo": "Running a simulation – no API calls, fictional data",
    "toast.demoOffline": "Preview: running a simulation – no AI calls, fictional data",
    "toast.signed": "Form signed – welcome, {client}!", "toast.welcomeBack": "Welcome back, {client}!",
    "toast.resigned": "The office will now work with {client}",

    "log.open": "The office is open.", "log.handoff": "{from} → {to}: handover{msg}", "log.newJob": "New task: {prompt}",
    "log.approved": "The Chief Investment Officer signed off the report.", "log.failed": "Task failed: {error}",
    "log.signed": "{client} signed the commitment form ({no}).",

    "greet.ohGuest": "Oh, a visitor!", "greet.hello": "Hello! Welcome to Mini Capital.",
    "greet.intro": "I'm the Chief Investment Officer. Our AI team researches stocks based on your requests.",
    "greet.pledge": "Before we begin, please read and sign our commitment form.", "greet.readTerms": "Please take a moment to read the terms…",
    "greet.thanks": "Thank you, {client}! It's a pleasure to work with you.", "greet.giveTask": "Please give us a task in the box below.",
    "greet.welcomeBack": "Welcome back, {client}!", "greet.reportReady": "Your report is ready, {client}.",
    "greet.reportReadyAnon": "The report is ready!", "greet.resigned": "Glad to work with you, {client}!",

    "intro.tag": "AI stock research & portfolio office", "intro.hello": "Hello, and welcome!",
    "intro.chooseLang": "Choose your language", "intro.enter": "Enter the office",

    "pledge.title": "SERVICE COMMITMENT FORM", "pledge.lead": "I, the undersigned, confirm that I have read and understood the following:",
    "pledge.t1": "All staff at Mini Capital are <strong>AI assistants</strong> (language models), not licensed financial professionals.",
    "pledge.t2": "Reports are <strong>for reference only</strong>; they are not investment advice nor an offer to buy or sell securities.",
    "pledge.t3": "The AI <strong>has no real-time market data</strong>; figures may be outdated, inaccurate or inferred by the AI. I will verify with official sources before making any decision.",
    "pledge.t4": "Investing in stocks carries the risk of losing capital. I am <strong>solely responsible</strong> for my own investment decisions.",
    "pledge.t5": "I will not enter sensitive information (passwords, account numbers, ID documents…). My requests are sent to the selected AI provider for processing.",
    "pledge.t6": "My name is stored only in this browser so the office can address me.",
    "pledge.nameLabel": "Client full name", "pledge.namePlaceholder": "Enter your full name",
    "pledge.agree": "I have read, understood and agree to the above.",
    "pledge.clientLabel": "CLIENT", "pledge.clientSub": "(signature & full name)",
    "pledge.officeLabel": "ON BEHALF OF MINI CAPITAL", "pledge.officeSub": "Chief Investment Officer (AI)", "pledge.officeSign": "AI Director",
    "pledge.stampRing": "MINI CAPITAL ✦ AI INVESTMENT OFFICE ✦", "pledge.stampCenter": "APPROVED",
    "pledge.submit": "Sign & stamp", "pledge.close": "Close", "pledge.cancel": "Cancel",
    "pledge.errName": "Please enter your full name (at least 2 characters).", "pledge.errAgree": "Please tick the agreement box before signing.",
    "pledge.no": "No.",
    "pledge.date": d => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),

    "wall.market": "MARKET · illustration", "wall.tagline": "Stock research & portfolio management",
    "sim.getWater": "Grabbing a drink", "sim.findDocs": "Looking for a book", "sim.toWindow": "To the window", "sim.sitRest": "Taking a seat",
    "sim.goChat": "Quick chat", "sim.planInvest": "Planning the investment", "sim.assign": "Assigning tasks",
    "sim.findReports": "Finding financial reports", "sim.readAnnual": "Reading the annual report", "sim.print": "Printing the report", "sim.printing": "Printing…",
    "sim.handoffTo": "Handing over to {name}", "sim.handoffDefault": "My part is done!", "sim.done": "Part done ✔",
    "sim.thinking": "💭 Thinking…", "sim.writing": "Writing…",
    "printer.title": "Printer", "printer.open": "Open printer", "printer.count": "{n} reports in the cabinet · {k} selected", "printer.empty": "The cabinet is empty. Save a report to the cabinet before printing.", "printer.all": "Select all", "printer.none": "Clear", "printer.go": "Print {k}", "printer.pick": "Select reports to print", "printer.hint": "Tip: click the printer in the office to open the print list.", "printer.toast": "The CIO is printing {k} report(s)…", "printer.busy": "The printer is busy, one moment.", "print.kind": "Investment research report", "print.client": "Client", "print.saved": "Saved", "print.printed": "Printed", "print.info": "Details", "print.footer": "Prepared by the Mini Capital AI team. For reference only; not investment advice.", "sim.toPrinter": "Off to the printer", "sim.printDone": "All printed! 🖨️", "log.printed": "Printed: {title}",
    "sim.toCabinet": "Filing the report", "sim.filing": "🗂️ Filed away neatly…", "sim.trashSay": "We won't need this one…", "sim.crumple": "*crinkle crinkle* 🤏", "sim.score": "Swish! 🗑️ Nice and tidy.", "sim.pocket": "I'll bin it later.",
  },

  ja: {
    "doc.title": "ミニキャピタル – AI投資オフィス",
    "brand.tagline": "AI株式リサーチ＆運用オフィス",
    "common.loading": "読み込み中…",
    "a11y.openMenu": "メニューを開く", "a11y.collapse": "折りたたむ", "a11y.openReport": "レポートを開く", "a11y.openTeam": "チームを開く",
    "a11y.office": "ミニキャピタルのオフィス", "a11y.task": "依頼を出す",
    "conn.connecting": "接続中…", "conn.on": "接続済み", "conn.off": "接続切れ", "conn.preview": "プレビュー版", "conn.title": "バックエンド接続",

    "menu.title": "メニュー", "menu.close": "メニューを閉じる",
    "menu.language": "言語",
    "menu.ai": "AI設定", "menu.leaderModel": "運用責任者", "menu.teamModel": "リサーチチーム（アナリスト3名）",
    "menu.modelHint": "<code>.env</code> にAPIキーがないモデルは選択できません。",
    "menu.client": "お客様", "menu.furniture": "家具",
    "menu.display": "表示とテスト", "menu.showReport": "レポート欄（左）", "menu.showSide": "チームと活動ログ（右）",
    "menu.runDemo": "シミュレーション実行（API不要）", "menu.replayIntro": "オープニングを再生",

    "models.noKey": "（APIキーなし）", "models.offline": "AIサーバーなし – シミュレーションモード",

    "client.unsigned": "同意書はまだ署名されていません。", "client.viewPledge": "同意書を見る", "client.resign": "別の名前で署名",
    "client.badge": "{name}様", "client.info": "{name}様 · 署名日 {date} · {no}",
    "client.address": "{name}様", "client.guest": "ゲスト",

    "furn.enable": "配置モードをオン", "furn.done": "配置を終了",
    "furn.help": "家具を選び、床をクリックして配置します。ドラッグで移動 · <kbd>R</kbd> 回転 · <kbd>Del</kbd> 削除 · <kbd>Esc</kbd> キャンセル。",
    "furn.count": "（{n}点）", "furn.none": "何も選択されていません。",
    "furn.selected": "{label} · 向き {deg}°", "furn.ready": "配置準備：{label} · 向き {deg}°",
    "furn.seatedLabel": "この席に座る人", "furn.emptyDesk": "— 空席 —", "furn.emptyLabel": "空席",
    "furn.rotate": "90°回転", "furn.delete": "削除", "furn.reset": "初期配置", "furn.confirm": "もう一度押して確定",
    "furn.cantPlace": "ここには置けません：他の家具と重なるか、部屋の外です。",
    "furn.shiftHint": "Shiftを押したままで同じ家具を続けて配置できます。", "furn.placed": "{label}を配置しました。ドラッグで移動、Rで回転。",
    "furn.cantRotate": "回転できません：他の家具か壁に当たります。", "furn.deleted": "{label}を削除しました。",
    "furn.restored": "初期配置に戻しました。", "furn.placing": "{label}を配置中：床をクリック（Rで回転、Shiftで連続配置）。",
    "furn.cancelPlace": "配置をキャンセルしました。", "furn.assigned": "{title}がこの席に座ります。", "furn.unassigned": "空席になりました。",
    "furn.storageFail": "このブラウザでは配置を保存できません（localStorageがブロックされています）。",
    "furn.warn.noDesk": "{title}の席がありません – 空いている場所で待機します。", "furn.warn.blocked": "{title}の椅子への通路がふさがれています。",
    "furn.warn.noWhiteboard": "ホワイトボードがないため、運用責任者は自席で計画を立てます。",
    "furn.warn.noBookshelf": "本棚がないため、リサーチアナリストは自席で調べます。",
    "furn.warn.noPrinter": "プリンターがないため、リスク管理担当は直接報告書を渡します。",
    "furn.warn.noCabinet": "書類キャビネットがありません：保存はできますが、運用責任者がしまう場所がありません。", "furn.warn.noTrash": "ゴミ箱がありません：運用責任者は丸めた紙をポケットにしまいます。",
    "furn.item.desk": "デスク", "furn.item.meeting": "会議テーブル", "furn.item.bookshelf": "本棚", "furn.item.whiteboard": "ホワイトボード",
    "furn.item.printer": "プリンター", "furn.item.watercooler": "ウォーターサーバー", "furn.item.vending": "自動販売機", "furn.item.sofa": "ソファ",
    "furn.item.plant": "観葉植物", "furn.item.chair": "椅子",
    "furn.item.cabinet": "書類キャビネット", "furn.item.trash": "ゴミ箱",

    "report.title": "投資レポート", "report.copy": "コピー", "report.copied": "コピーしました", "report.copyFail": "コピーできません",
    "report.placeholder": "運用責任者が審査・承認すると、ここにレポートが表示されます。",
    "report.meta": "宛先：{client} · {time} · {models} · {secs}秒", "report.demoTag": "シミュレーション",
    "report.fromServer": "サーバー上の最新レポート", "report.failed": "タスクが失敗しました：\n{error}",
    "report.expand": "全画面表示", "report.shrink": "全画面を終了", "report.save": "キャビネットに保存", "report.saved": "保存済み", "report.delete": "削除", "report.confirmDelete": "もう一度押すと削除", "report.toastSaved": "レポートをキャビネットにしまいました", "log.filed": "キャビネットに保存：{title}", "report.toastDeleted": "レポートを削除しました", "report.untitled": "無題のレポート", "report.fromArchive": "書類キャビネットより · 保存日時 {time}", "cabinet.title": "書類キャビネット", "cabinet.open": "書類キャビネットを開く", "cabinet.close": "閉じる", "cabinet.count": "保存済みレポート {n}/{max} 件", "cabinet.empty": "キャビネットは空です。レポート下の「キャビネットに保存」で保存できます。", "cabinet.view": "開く", "cabinet.delete": "削除", "cabinet.confirm": "本当に？", "cabinet.current": "表示中", "cabinet.full": "キャビネットがいっぱいです（{n} 件）。先にいくつか削除してください。", "cabinet.storageFail": "ブラウザに保存できませんでした（容量不足またはプライベートモード）。", "cabinet.hint": "ヒント：運用責任者の机の横にあるキャビネットをクリックしても開けます。",
    "team.title": "チーム", "log.title": "活動ログ",
    "team.status.idle": "待機中", "team.status.thinking": "計画中", "team.status.working": "作業中",
    "team.status.reviewing": "レポート作成", "team.status.done": "完了", "team.status.error": "エラー",

    "zoom.group": "オフィスの拡大縮小", "zoom.out": "縮小（ - ）", "zoom.in": "拡大（ + ）", "zoom.reset": "表示をリセット（ 0 またはダブルクリック ）",

    "task.placeholder": "例：銀行株を分析してください。資金は100万円、3年の長期投資で、リスクは中程度まで許容します。",
    "task.send": "依頼する", "task.sendDemo": "依頼する（シミュレーション）", "task.busy": "作業中…", "task.sending": "送信中…",
    "task.needPledge": "先に同意書に署名してください",
    "task.hint": "Ctrl + Enter で送信 · ホイールで拡大縮小、ドラッグで移動、ダブルクリックでリセット · レポートはAIが作成した参考情報です。",

    "status.connecting": "バックエンドに接続中…", "status.connected": "接続しました。", "status.ready": "{client}、ご依頼をお待ちしています。",
    "status.offline": "GitHub Pages のプレビュー版 – AIサーバーはありません。「依頼する」は架空データでシミュレーションを実行します。",
    "status.busy": "オフィスは別のタスクを処理中です。", "status.accepted": "依頼を受け付けました：{prompt}",
    "status.done": "完了しました！投資レポートは左の欄にあります。", "status.error": "エラー：{error}",
    "status.disconnected": "バックエンドとの接続が切れました – {s}秒後に再接続します…（☰メニューからシミュレーションは実行できます）",
    "status.noKeys": ".env にAPIキーがありません – キーを追加してバックエンドを再起動してください。",
    "status.modelsFail": "モデル一覧を読み込めません：{error}",
    "status.needPledge": "依頼の前に同意書へのご署名が必要です。", "status.emptyPrompt": "まずオフィスへのご依頼を入力してください。",
    "status.rejected": "依頼できませんでした：{detail}", "status.sendFail": "バックエンドに送信できません：{error}",

    "toast.demo": "シミュレーション実行中 – APIは使わず、データは架空です",
    "toast.demoOffline": "プレビュー版：シミュレーション実行中 – AIは使わず、データは架空です",
    "toast.signed": "署名完了 – ようこそ、{client}！", "toast.welcomeBack": "{client}、おかえりなさいませ！",
    "toast.resigned": "今後は{client}を担当いたします",

    "log.open": "オフィスが開きました。", "log.handoff": "{from} → {to}：引き継ぎ{msg}", "log.newJob": "新しい依頼：{prompt}",
    "log.approved": "運用責任者がレポートを承認しました。", "log.failed": "タスク失敗：{error}",
    "log.signed": "{client}が同意書に署名しました（{no}）。",

    "greet.ohGuest": "おや、お客様だ！", "greet.hello": "いらっしゃいませ！ミニキャピタルへようこそ。",
    "greet.intro": "私は運用責任者です。AIチームがご依頼に合わせて株式を調査いたします。",
    "greet.pledge": "始める前に、同意書をお読みいただき、ご署名をお願いします。", "greet.readTerms": "内容をご確認ください…",
    "greet.thanks": "{client}、ありがとうございます！ご一緒できて光栄です。", "greet.giveTask": "下の欄からご依頼をどうぞ。",
    "greet.welcomeBack": "{client}、おかえりなさいませ！", "greet.reportReady": "{client}、レポートの準備ができました。",
    "greet.reportReadyAnon": "レポートが完成しました！", "greet.resigned": "{client}、よろしくお願いいたします！",

    "intro.tag": "AI株式リサーチ＆運用オフィス", "intro.hello": "ようこそ、いらっしゃいませ！",
    "intro.chooseLang": "言語を選択", "intro.enter": "オフィスに入る",

    "pledge.title": "サービス利用同意書", "pledge.lead": "私（下記署名者）は、以下の内容を読み、理解したことを確認します。",
    "pledge.t1": "ミニキャピタルのスタッフは全員<strong>AIアシスタント</strong>（言語モデル）であり、認可を受けた金融の専門家ではありません。",
    "pledge.t2": "レポートは<strong>参考情報</strong>にすぎず、投資助言や有価証券の売買の勧誘ではありません。",
    "pledge.t3": "AIは<strong>リアルタイムの市場データを持っていません</strong>。数値は古い、不正確、またはAIによる推測である可能性があります。判断の前に公式な情報源で確認します。",
    "pledge.t4": "株式投資には元本割れのリスクがあります。投資判断の<strong>責任はすべて私自身</strong>が負います。",
    "pledge.t5": "機密情報（パスワード、口座番号、身分証明書など）は入力しません。依頼内容は選択したAIプロバイダーに送信され処理されます。",
    "pledge.t6": "私の名前は、オフィスが呼びかけるためにこのブラウザにのみ保存されます。",
    "pledge.nameLabel": "お客様のお名前", "pledge.namePlaceholder": "お名前を入力してください",
    "pledge.agree": "上記の内容を読み、理解し、同意します。",
    "pledge.clientLabel": "お客様", "pledge.clientSub": "（署名・氏名）",
    "pledge.officeLabel": "ミニキャピタル代表", "pledge.officeSub": "運用責任者（AI）", "pledge.officeSign": "AI部長",
    "pledge.stampRing": "ミニキャピタル ✦ AI投資オフィス ✦", "pledge.stampCenter": "承認",
    "pledge.submit": "署名して押印", "pledge.close": "閉じる", "pledge.cancel": "キャンセル",
    "pledge.errName": "お名前を入力してください（2文字以上）。", "pledge.errAgree": "署名の前に同意にチェックを入れてください。",
    "pledge.no": "番号:",
    "pledge.date": d => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,

    "wall.market": "マーケット · イメージ", "wall.tagline": "株式リサーチ＆運用",
    "sim.getWater": "飲み物を取りに", "sim.findDocs": "資料を探す", "sim.toWindow": "窓辺へ", "sim.sitRest": "ちょっと休憩",
    "sim.goChat": "ちょっと雑談", "sim.planInvest": "投資計画を立案", "sim.assign": "タスクを割り振り",
    "sim.findReports": "財務報告書を探す", "sim.readAnnual": "年次報告書を読む", "sim.print": "レポートを印刷", "sim.printing": "印刷中…",
    "sim.handoffTo": "{name}へ引き継ぎ", "sim.handoffDefault": "私の分は終わりました！", "sim.done": "担当完了 ✔",
    "sim.thinking": "💭 考え中…", "sim.writing": "執筆中…",
    "printer.title": "プリンター", "printer.open": "プリンターを開く", "printer.count": "キャビネット内 {n} 件 · {k} 件選択", "printer.empty": "キャビネットは空です。印刷する前にレポートを保存してください。", "printer.all": "すべて選択", "printer.none": "選択解除", "printer.go": "{k} 件を印刷", "printer.pick": "印刷するレポートを選択", "printer.hint": "ヒント：オフィスのプリンターをクリックすると印刷リストが開きます。", "printer.toast": "運用責任者が {k} 件を印刷しています…", "printer.busy": "印刷中です。少々お待ちください。", "print.kind": "投資リサーチレポート", "print.client": "お客様", "print.saved": "保存日時", "print.printed": "印刷日時", "print.info": "詳細", "print.footer": "Mini Capital の AI チームが作成。参考情報であり、投資助言ではありません。", "sim.toPrinter": "プリンターへ", "sim.printDone": "印刷完了！🖨️", "log.printed": "印刷しました：{title}",
    "sim.toCabinet": "書類をしまう", "sim.filing": "🗂️ きちんと保管…", "sim.trashSay": "これはもう要らないな…", "sim.crumple": "*くしゃくしゃ* 🤏", "sim.score": "ナイスシュート！🗑️", "sim.pocket": "後で捨てておこう。",
  },
};

const LOCALES = { vi: "vi-VN", en: "en-GB", ja: "ja-JP" };

let lang = (() => {
  try { const v = localStorage.getItem(LANG_KEY); return DICT[v] ? v : "vi"; } catch { return "vi"; }
})();

export const getLang = () => lang;
export const locale = () => LOCALES[lang];

export function t(key, params = {}) {
  let s = DICT[lang][key] ?? DICT.vi[key] ?? key;
  if (typeof s === "function") return s(params);
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
}

// Cách xưng hô với khách theo từng ngôn ngữ: "Quý khách An" / "An" / "An様".
export const clientName = name => t("client.address", { name });

export function setLang(code) {
  if (!DICT[code] || code === lang) return;
  lang = code;
  try { localStorage.setItem(LANG_KEY, code); } catch { /* bỏ qua */ }
  applyI18n();
  window.dispatchEvent(new CustomEvent("langchange", { detail: code }));
}

export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  document.title = t("doc.title");
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); }); // chỉ chuỗi tĩnh trong DICT
  root.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll("[data-i18n-aria-label]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });
  root.querySelectorAll("[data-lang]").forEach(el => {
    el.classList.toggle("active", el.dataset.lang === lang);
    el.setAttribute("aria-checked", String(el.dataset.lang === lang));
  });
}

export const fmtTime = (d = new Date()) => d.toLocaleTimeString(locale(), { hour12: false });
export const fmtDateTime = (d = new Date()) => d.toLocaleString(locale(), { hour12: false });
export const fmtDate = (d = new Date()) => d.toLocaleDateString(locale());
