/**
 * Learning-profile choices. Industries/positions are WeWIN's official list; audiences, goals,
 * levels and frequencies are still placeholders.
 * Ids are stored in learner profiles: industry ids are fixed, position ids derive from the label,
 * so renaming a position changes its id (old profiles then show the raw id).
 */

export type Option = { id: string; label: string };
export type Industry = Option & { positions: Option[] };

export const OTHER = "other";

/** Stable id from a Vietnamese label: "Nhân viên kho" → "nhan_vien_kho". */
export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const pos = (list: string): Option[] => [
  ...list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ id: slugify(label), label })),
  { id: OTHER, label: "Khác" },
];

const sector = (id: string, label: string, positions: string): Industry => ({ id, label, positions: pos(positions) });

export const INDUSTRIES: Industry[] = [
  sector("it", "Công nghệ thông tin", "Lập trình viên, Kỹ sư phần mềm, Tester, IT Helpdesk, Quản trị mạng, Quản trị hệ thống, Chuyên viên dữ liệu, Chuyên viên AI, Chuyên viên an ninh mạng, Thiết kế UI/UX"),
  sector("finance_banking", "Tài chính – Ngân hàng", "Nhân viên ngân hàng, Giao dịch viên, Chuyên viên tín dụng, Chuyên viên tài chính, Chuyên viên đầu tư, Chuyên viên bảo hiểm, Chuyên viên quản lý rủi ro"),
  sector("accounting", "Kế toán – Kiểm toán", "Kế toán viên, Kế toán tổng hợp, Kế toán trưởng, Kế toán thuế, Kiểm toán viên, Kiểm soát viên tài chính"),
  sector("hr_admin", "Nhân sự – Hành chính", "Nhân viên nhân sự, Chuyên viên tuyển dụng, Chuyên viên đào tạo, Nhân viên hành chính, Trợ lý giám đốc, Thư ký, Quản lý nhân sự"),
  sector("marketing", "Marketing – Truyền thông", "Nhân viên Marketing, Chuyên viên Digital Marketing, Chuyên viên SEO, Nhân viên Content, Biên tập viên, Chuyên viên PR, Chuyên viên truyền thông, Chuyên viên thương hiệu"),
  sector("sales", "Kinh doanh – Bán hàng", "Nhân viên kinh doanh, Nhân viên bán hàng, Nhân viên tư vấn, Nhân viên telesales, Chuyên viên phát triển kinh doanh, Quản lý kinh doanh"),
  sector("customer_service", "Chăm sóc khách hàng", "Nhân viên chăm sóc khách hàng, Nhân viên tổng đài, Nhân viên hỗ trợ kỹ thuật, Chuyên viên xử lý khiếu nại, Quản lý dịch vụ khách hàng"),
  sector("ecommerce", "Thương mại điện tử", "Nhân viên thương mại điện tử, Nhân viên vận hành sàn, Nhân viên quản lý đơn hàng, Nhân viên mua hàng, Quản lý cửa hàng"),
  sector("manufacturing", "Sản xuất – Công nghiệp", "Công nhân sản xuất, Nhân viên vận hành máy, Kỹ sư sản xuất, Kỹ sư cơ khí, Kỹ sư điện, Nhân viên QC, Nhân viên QA, Nhân viên bảo trì, Giám sát sản xuất"),
  sector("construction", "Xây dựng – Kiến trúc", "Kỹ sư xây dựng, Kiến trúc sư, Kỹ sư giám sát, Chỉ huy công trình, Nhân viên thiết kế nội thất, Nhân viên dự toán, Công nhân xây dựng"),
  sector("logistics", "Logistics – Vận tải", "Nhân viên logistics, Nhân viên xuất nhập khẩu, Nhân viên khai báo hải quan, Nhân viên chứng từ, Nhân viên kho, Nhân viên giao nhận, Tài xế, Nhân viên điều phối vận tải"),
  sector("tourism_hotel", "Du lịch – Khách sạn", "Hướng dẫn viên du lịch, Nhân viên điều hành tour, Nhân viên lễ tân, Nhân viên đặt phòng, Nhân viên buồng phòng, Quản lý khách sạn, Nhân viên đại lý du lịch"),
  sector("restaurant", "Nhà hàng – Ẩm thực", "Nhân viên phục vụ, Đầu bếp, Phụ bếp, Bếp trưởng, Nhân viên pha chế, Nhân viên thu ngân, Quản lý nhà hàng"),
  sector("aviation_maritime", "Hàng không – Hàng hải", "Phi công, Tiếp viên hàng không, Nhân viên sân bay, Nhân viên điều hành bay, Thuyền trưởng, Thủy thủ, Kỹ sư tàu biển"),
  sector("education", "Giáo dục – Đào tạo", "Giáo viên, Giảng viên, Giáo viên tiếng Anh, Giáo viên IELTS, Trợ giảng, Gia sư, Chuyên viên tư vấn tuyển sinh, Chuyên viên học vụ, Quản lý trung tâm"),
  sector("healthcare", "Y tế – Chăm sóc sức khỏe", "Bác sĩ, Y tá, Điều dưỡng, Dược sĩ, Kỹ thuật viên xét nghiệm, Nhân viên y tế, Nhân viên chăm sóc bệnh nhân, Chuyên viên dinh dưỡng"),
  sector("pharma_bio", "Dược phẩm – Sinh học", "Trình dược viên, Nhân viên sản xuất dược phẩm, Nhân viên kiểm nghiệm, Chuyên viên nghiên cứu dược phẩm, Chuyên viên đăng ký thuốc"),
  sector("legal", "Pháp luật – Luật", "Luật sư, Chuyên viên pháp chế, Trợ lý luật sư, Công chứng viên, Thẩm phán, Kiểm sát viên, Chuyên viên tư vấn pháp lý"),
  sector("real_estate", "Bất động sản", "Nhân viên môi giới bất động sản, Nhân viên kinh doanh dự án, Chuyên viên tư vấn bất động sản, Nhân viên định giá, Quản lý bất động sản"),
  sector("agriculture", "Nông nghiệp – Thủy sản", "Nông dân, Kỹ sư nông nghiệp, Kỹ sư chăn nuôi, Bác sĩ thú y, Nhân viên nuôi trồng thủy sản, Quản lý trang trại"),
  sector("energy_environment", "Năng lượng – Môi trường", "Kỹ sư điện, Kỹ sư năng lượng, Kỹ sư môi trường, Nhân viên xử lý chất thải, Nhân viên an toàn lao động"),
  sector("design_art", "Thiết kế – Nghệ thuật", "Nhà thiết kế đồ họa, Nhà thiết kế thời trang, Nhà thiết kế nội thất, Nhiếp ảnh gia, Quay phim, Biên tập viên video, Họa sĩ, Diễn viên, Ca sĩ, Đạo diễn"),
  sector("fashion_beauty", "Thời trang – Làm đẹp", "Nhân viên tư vấn thời trang, Chuyên viên trang điểm, Thợ làm tóc, Nhân viên spa, Chuyên viên chăm sóc da, Nhân viên nail"),
  sector("science", "Khoa học – Nghiên cứu", "Nhà nghiên cứu khoa học, Trợ lý nghiên cứu, Nhà hóa học, Nhà sinh học, Nhân viên phòng thí nghiệm, Chuyên viên R&D"),
  sector("public_sector", "Nhà nước – Hành chính công", "Công chức, Cán bộ hành chính, Cán bộ ngoại giao, Cán bộ thuế, Cán bộ hải quan, Chuyên viên chính sách"),
  sector("security", "Quân đội – Công an – An ninh", "Sĩ quan quân đội, Quân nhân, Công an, Cảnh sát, Nhân viên bảo vệ, Nhân viên cứu hộ"),
  sector("sports", "Thể thao – Thể hình", "Vận động viên, Huấn luyện viên thể thao, Huấn luyện viên cá nhân, Giáo viên thể dục, Trọng tài, Nhân viên phòng gym"),
  sector("ngo", "Tổ chức phi chính phủ – Xã hội", "Nhân viên dự án, Điều phối viên dự án, Nhân viên phát triển cộng đồng, Chuyên viên gây quỹ, Nhân viên đối ngoại"),
  sector("telecom", "Viễn thông – Điện tử", "Kỹ sư viễn thông, Kỹ sư điện tử, Kỹ thuật viên mạng, Kỹ thuật viên sửa chữa điện tử"),
  sector("personal_services", "Dịch vụ cá nhân", "Người giúp việc, Bảo mẫu, Nhân viên chăm sóc trẻ em, Nhân viên chăm sóc người cao tuổi, Nhân viên vệ sinh, Nhân viên giặt ủi"),
  { id: OTHER, label: "Khác", positions: pos("") },
];

export const AUDIENCES: Option[] = [
  { id: "customers", label: "Khách hàng nước ngoài" },
  { id: "partners", label: "Đối tác / Nhà cung cấp" },
  { id: "managers", label: "Cấp trên người nước ngoài" },
  { id: "colleagues", label: "Đồng nghiệp quốc tế" },
  { id: "recruiters", label: "Nhà tuyển dụng" },
  { id: "travel", label: "Người nước ngoài khi đi công tác / du lịch" },
];

export const GOALS: Option[] = [
  { id: "meetings", label: "Họp và trao đổi công việc" },
  { id: "phone", label: "Gọi điện / video call" },
  { id: "presentation", label: "Thuyết trình, báo cáo" },
  { id: "small_talk", label: "Giao tiếp xã giao, xây dựng quan hệ" },
  { id: "customer_service", label: "Tư vấn, hỗ trợ khách hàng" },
  { id: "negotiation", label: "Đàm phán, thuyết phục" },
  { id: "interview", label: "Phỏng vấn xin việc" },
  { id: "messaging", label: "Trao đổi qua tin nhắn / email" },
];

export const LEVELS = [
  { id: "starter", label: "Mới bắt đầu", description: "Biết một số từ, chưa tự nói được câu hoàn chỉnh." },
  { id: "elementary", label: "Sơ cấp", description: "Nói được câu ngắn, đơn giản nhưng còn ngập ngừng." },
  { id: "intermediate", label: "Trung cấp", description: "Trao đổi được việc quen thuộc, đôi khi thiếu từ." },
  { id: "upper", label: "Khá", description: "Giao tiếp khá tự tin, muốn trôi chảy và chuyên nghiệp hơn." },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];
export const LEVEL_IDS: LevelId[] = LEVELS.map((l) => l.id);

export const FREQUENCIES = [
  { id: "rarely", label: "Hầu như không dùng" },
  { id: "monthly", label: "Vài lần mỗi tháng" },
  { id: "weekly", label: "Vài lần mỗi tuần" },
  { id: "daily", label: "Hằng ngày" },
] as const;

export type FrequencyId = (typeof FREQUENCIES)[number]["id"];

/** Desired study length, in months. */
export const GENDERS = [
  { id: "male", label: "Nam" },
  { id: "female", label: "Nữ" },
  { id: "other", label: "Khác" },
] as const;

export type GenderId = (typeof GENDERS)[number]["id"];

export const DURATIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), label: `${n} tháng` }));
export const MAX_DURATION_MONTHS = 6;

export function levelInfo(id: LevelId) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

/** Moves `steps` levels up/down, clamped to the scale. */
export function shiftLevel(id: LevelId, steps: number): LevelId {
  const i = LEVEL_IDS.indexOf(id) + steps;
  return LEVEL_IDS[Math.max(0, Math.min(LEVEL_IDS.length - 1, i))];
}

export function labelOf(options: readonly Option[], id: string): string | undefined {
  return options.find((o) => o.id === id)?.label;
}
