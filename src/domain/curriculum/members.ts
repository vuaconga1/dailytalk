import type { Audience, ClusterId, Member } from "./types";

type People = Partial<Record<Audience, [string, string]>>;
const m = (cluster: ClusterId, job: string, vars?: Record<string, string>, people?: People): Member => ({ cluster, job, vars, people });

type IndustryMembers = { fallback: Member; positions: Record<string, Member> };

/**
 * Which cluster each position learns with. Keys are the Vietnamese labels in profile-options
 * (matched through slugify); `fallback` is used for "Khác" and unknown positions.
 */
export const INDUSTRY_MEMBERS: Record<string, IndustryMembers> = {
  it: {
    fallback: m("tech", "IT specialist"),
    positions: {
      "Lập trình viên": m("tech", "software developer"),
      "Kỹ sư phần mềm": m("tech", "software engineer"),
      Tester: m("tech", "software tester"),
      "IT Helpdesk": m("support", "IT helpdesk officer", { item: "your computer" }, { customers: ["user", "người dùng"] }),
      "Quản trị mạng": m("tech", "network administrator", { system: "the network" }),
      "Quản trị hệ thống": m("tech", "system administrator", { system: "the server" }),
      "Chuyên viên dữ liệu": m("tech", "data analyst", { system: "the dashboard" }),
      "Chuyên viên AI": m("tech", "AI specialist", { system: "the AI model" }),
      "Chuyên viên an ninh mạng": m("tech", "cybersecurity specialist", { system: "the system" }),
      "Thiết kế UI/UX": m("creative", "UI/UX designer", { work: "the app design" }),
    },
  },
  finance_banking: {
    fallback: m("finance_legal", "finance specialist"),
    positions: {
      "Nhân viên ngân hàng": m("support", "bank officer", { item: "your account" }),
      "Giao dịch viên": m("support", "bank teller", { item: "your account" }),
      "Chuyên viên tín dụng": m("finance_legal", "credit officer", { doc: "the loan application" }),
      "Chuyên viên tài chính": m("finance_legal", "financial specialist"),
      "Chuyên viên đầu tư": m("sales", "investment consultant", { product: "the investment fund" }),
      "Chuyên viên bảo hiểm": m("sales", "insurance consultant", { product: "the insurance plan" }),
      "Chuyên viên quản lý rủi ro": m("finance_legal", "risk management specialist", { doc: "the risk report" }),
    },
  },
  accounting: {
    fallback: m("finance_legal", "accountant"),
    positions: {
      "Kế toán viên": m("finance_legal", "accountant"),
      "Kế toán tổng hợp": m("finance_legal", "general accountant"),
      "Kế toán trưởng": m("finance_legal", "chief accountant"),
      "Kế toán thuế": m("finance_legal", "tax accountant", { doc: "the tax return" }),
      "Kiểm toán viên": m("finance_legal", "auditor", { doc: "the audit report" }),
      "Kiểm soát viên tài chính": m("finance_legal", "financial controller"),
    },
  },
  hr_admin: {
    fallback: m("office", "HR and admin officer"),
    positions: {
      "Nhân viên nhân sự": m("office", "HR officer", { doc: "the employee handbook" }),
      "Chuyên viên tuyển dụng": m("office", "recruiter", { doc: "the job description" }),
      "Chuyên viên đào tạo": m("education", "training specialist", { class: "the training session" }, { customers: ["trainee", "học viên"] }),
      "Nhân viên hành chính": m("office", "administrative officer"),
      "Trợ lý giám đốc": m("office", "executive assistant", { doc: "the meeting schedule" }),
      "Thư ký": m("office", "secretary", { doc: "the meeting agenda" }),
      "Quản lý nhân sự": m("office", "HR manager", { doc: "the HR policy" }),
    },
  },
  marketing: {
    fallback: m("creative", "marketing executive", { work: "the campaign" }),
    positions: {
      "Nhân viên Marketing": m("creative", "marketing executive", { work: "the campaign" }),
      "Chuyên viên Digital Marketing": m("creative", "digital marketing specialist", { work: "the ad campaign" }),
      "Chuyên viên SEO": m("creative", "SEO specialist", { work: "the website content" }),
      "Nhân viên Content": m("creative", "content writer", { work: "the article" }),
      "Biên tập viên": m("creative", "editor", { work: "the article" }),
      "Chuyên viên PR": m("creative", "PR specialist", { work: "the press release" }),
      "Chuyên viên truyền thông": m("creative", "communications specialist", { work: "the campaign" }),
      "Chuyên viên thương hiệu": m("creative", "brand specialist", { work: "the brand guideline" }),
    },
  },
  sales: {
    fallback: m("sales", "sales executive"),
    positions: {
      "Nhân viên kinh doanh": m("sales", "sales executive"),
      "Nhân viên bán hàng": m("sales", "sales assistant"),
      "Nhân viên tư vấn": m("sales", "sales consultant"),
      "Nhân viên telesales": m("sales", "telesales agent"),
      "Chuyên viên phát triển kinh doanh": m("sales", "business development executive", { product: "our service package" }),
      "Quản lý kinh doanh": m("sales", "sales manager"),
    },
  },
  customer_service: {
    fallback: m("support", "customer service officer"),
    positions: {
      "Nhân viên chăm sóc khách hàng": m("support", "customer service officer"),
      "Nhân viên tổng đài": m("support", "call center agent"),
      "Nhân viên hỗ trợ kỹ thuật": m("support", "technical support officer", { item: "your device" }),
      "Chuyên viên xử lý khiếu nại": m("support", "complaints officer"),
      "Quản lý dịch vụ khách hàng": m("support", "customer service manager"),
    },
  },
  ecommerce: {
    fallback: m("support", "e-commerce executive"),
    positions: {
      "Nhân viên thương mại điện tử": m("support", "e-commerce executive"),
      "Nhân viên vận hành sàn": m("support", "marketplace operations executive"),
      "Nhân viên quản lý đơn hàng": m("support", "order management executive"),
      "Nhân viên mua hàng": m("logistics", "purchasing officer", { cargo: "the order" }),
      "Quản lý cửa hàng": m("support", "store manager"),
    },
  },
  manufacturing: {
    fallback: m("engineering", "production staff"),
    positions: {
      "Công nhân sản xuất": m("engineering", "production worker"),
      "Nhân viên vận hành máy": m("engineering", "machine operator"),
      "Kỹ sư sản xuất": m("engineering", "production engineer"),
      "Kỹ sư cơ khí": m("engineering", "mechanical engineer"),
      "Kỹ sư điện": m("engineering", "electrical engineer", { equipment: "the electrical panel" }),
      "Nhân viên QC": m("engineering", "QC inspector"),
      "Nhân viên QA": m("engineering", "QA officer"),
      "Nhân viên bảo trì": m("engineering", "maintenance technician"),
      "Giám sát sản xuất": m("engineering", "production supervisor"),
    },
  },
  construction: {
    fallback: m("engineering", "construction engineer", { site: "the construction site", equipment: "the equipment" }),
    positions: {
      "Kỹ sư xây dựng": m("engineering", "civil engineer", { site: "the construction site", equipment: "the crane" }),
      "Kiến trúc sư": m("creative", "architect", { work: "the drawings" }),
      "Kỹ sư giám sát": m("engineering", "site supervisor", { site: "the construction site", equipment: "the equipment" }),
      "Chỉ huy công trình": m("engineering", "site manager", { site: "the construction site", equipment: "the equipment" }),
      "Nhân viên thiết kế nội thất": m("creative", "interior designer", { work: "the interior design" }),
      "Nhân viên dự toán": m("engineering", "quantity surveyor", { site: "the construction site", equipment: "the materials" }),
      "Công nhân xây dựng": m("engineering", "construction worker", { site: "the construction site", equipment: "the equipment" }),
    },
  },
  logistics: {
    fallback: m("logistics", "logistics executive"),
    positions: {
      "Nhân viên logistics": m("logistics", "logistics executive"),
      "Nhân viên xuất nhập khẩu": m("logistics", "import-export executive"),
      "Nhân viên khai báo hải quan": m("logistics", "customs declarant"),
      "Nhân viên chứng từ": m("logistics", "documentation executive"),
      "Nhân viên kho": m("logistics", "warehouse staff", { cargo: "the goods" }),
      "Nhân viên giao nhận": m("logistics", "freight forwarder"),
      "Tài xế": m("operations", "driver", { unit: "the delivery route" }, { customers: ["customer", "khách hàng"], managers: ["dispatcher", "điều phối viên"] }),
      "Nhân viên điều phối vận tải": m("logistics", "transport coordinator", { cargo: "the delivery" }),
    },
  },
  tourism_hotel: {
    fallback: m("hospitality", "hotel staff"),
    positions: {
      "Hướng dẫn viên du lịch": m("hospitality", "tour guide", { place: "the tour", service: "the tour" }, { customers: ["tourist", "du khách"] }),
      "Nhân viên điều hành tour": m("hospitality", "tour operator", { place: "the tour", service: "the tour package" }),
      "Nhân viên lễ tân": m("hospitality", "receptionist"),
      "Nhân viên đặt phòng": m("support", "reservations agent", { item: "your booking" }),
      "Nhân viên buồng phòng": m("hospitality", "housekeeping attendant"),
      "Quản lý khách sạn": m("hospitality", "hotel manager"),
      "Nhân viên đại lý du lịch": m("sales", "travel agent", { product: "the tour package" }),
    },
  },
  restaurant: {
    fallback: m("hospitality", "restaurant staff", { place: "the restaurant", service: "the dish" }),
    positions: {
      "Nhân viên phục vụ": m("hospitality", "waiter", { place: "the restaurant", service: "the dish" }),
      "Đầu bếp": m("hospitality", "chef", { place: "the restaurant", service: "the dish" }),
      "Phụ bếp": m("hospitality", "kitchen assistant", { place: "the restaurant", service: "the dish" }),
      "Bếp trưởng": m("hospitality", "head chef", { place: "the restaurant", service: "the dish" }),
      "Nhân viên pha chế": m("hospitality", "bartender", { place: "the bar", service: "the drink" }),
      "Nhân viên thu ngân": m("hospitality", "cashier", { place: "the restaurant", service: "the bill" }),
      "Quản lý nhà hàng": m("hospitality", "restaurant manager", { place: "the restaurant", service: "the dish" }),
    },
  },
  aviation_maritime: {
    fallback: m("operations", "aviation and maritime staff"),
    positions: {
      "Phi công": m("operations", "pilot", { unit: "the flight" }, { customers: ["passenger", "hành khách"], managers: ["captain", "cơ trưởng"], partners: ["air traffic controller", "kiểm soát viên không lưu"] }),
      "Tiếp viên hàng không": m("hospitality", "flight attendant", { place: "the flight", service: "the meal service" }, { customers: ["passenger", "hành khách"] }),
      "Nhân viên sân bay": m("hospitality", "airport staff", { place: "the airport", service: "check-in" }, { customers: ["passenger", "hành khách"] }),
      "Nhân viên điều hành bay": m("operations", "flight dispatcher", { unit: "the flight" }, { customers: ["pilot", "phi công"], partners: ["ground staff", "nhân viên mặt đất"] }),
      "Thuyền trưởng": m("operations", "ship captain", { unit: "the ship" }, { customers: ["passenger", "hành khách"], managers: ["shipping company manager", "quản lý hãng tàu"], colleagues: ["crew member", "thuyền viên"], partners: ["port officer", "cán bộ cảng"] }),
      "Thủy thủ": m("operations", "sailor", { unit: "the ship" }, { customers: ["passenger", "hành khách"], managers: ["captain", "thuyền trưởng"], colleagues: ["crew member", "thuyền viên"], partners: ["port officer", "cán bộ cảng"] }),
      "Kỹ sư tàu biển": m("engineering", "marine engineer", { site: "the ship", equipment: "the engine" }),
    },
  },
  education: {
    fallback: m("education", "teacher"),
    positions: {
      "Giáo viên": m("education", "teacher"),
      "Giảng viên": m("education", "lecturer", { class: "the lecture" }),
      "Giáo viên tiếng Anh": m("education", "English teacher"),
      "Giáo viên IELTS": m("education", "IELTS teacher", { class: "the IELTS class" }),
      "Trợ giảng": m("education", "teaching assistant"),
      "Gia sư": m("education", "tutor", { class: "the lesson" }),
      "Chuyên viên tư vấn tuyển sinh": m("sales", "admissions consultant", { product: "our course" }),
      "Chuyên viên học vụ": m("office", "academic affairs officer", { doc: "the class schedule" }),
      "Quản lý trung tâm": m("office", "centre manager", { doc: "the monthly report" }),
    },
  },
  healthcare: {
    fallback: m("healthcare", "healthcare worker"),
    positions: {
      "Bác sĩ": m("healthcare", "doctor"),
      "Y tá": m("healthcare", "nurse"),
      "Điều dưỡng": m("healthcare", "registered nurse"),
      "Dược sĩ": m("healthcare", "pharmacist", { place: "the pharmacy" }),
      "Kỹ thuật viên xét nghiệm": m("healthcare", "lab technician", { place: "the lab" }),
      "Nhân viên y tế": m("healthcare", "medical staff"),
      "Nhân viên chăm sóc bệnh nhân": m("healthcare", "patient care assistant"),
      "Chuyên viên dinh dưỡng": m("healthcare", "nutritionist"),
    },
  },
  pharma_bio: {
    fallback: m("research", "pharmaceutical specialist"),
    positions: {
      "Trình dược viên": m("sales", "medical representative", { product: "our new medicine" }, { customers: ["doctor", "bác sĩ"] }),
      "Nhân viên sản xuất dược phẩm": m("engineering", "pharmaceutical production staff", { site: "the plant", equipment: "the production line" }),
      "Nhân viên kiểm nghiệm": m("research", "quality control analyst", { project: "the test" }),
      "Chuyên viên nghiên cứu dược phẩm": m("research", "pharmaceutical researcher"),
      "Chuyên viên đăng ký thuốc": m("finance_legal", "regulatory affairs specialist", { doc: "the registration dossier" }),
    },
  },
  legal: {
    fallback: m("finance_legal", "legal specialist", { doc: "the contract" }),
    positions: {
      "Luật sư": m("finance_legal", "lawyer", { doc: "the contract" }),
      "Chuyên viên pháp chế": m("finance_legal", "legal officer", { doc: "the contract" }),
      "Trợ lý luật sư": m("finance_legal", "paralegal", { doc: "the case file" }),
      "Công chứng viên": m("finance_legal", "notary", { doc: "the document" }),
      "Thẩm phán": m("finance_legal", "judge", { doc: "the case file" }),
      "Kiểm sát viên": m("finance_legal", "prosecutor", { doc: "the case file" }),
      "Chuyên viên tư vấn pháp lý": m("finance_legal", "legal consultant", { doc: "the contract" }),
    },
  },
  real_estate: {
    fallback: m("sales", "real estate agent", { product: "the apartment" }),
    positions: {
      "Nhân viên môi giới bất động sản": m("sales", "real estate agent", { product: "the apartment" }),
      "Nhân viên kinh doanh dự án": m("sales", "property sales executive", { product: "the project" }),
      "Chuyên viên tư vấn bất động sản": m("sales", "property consultant", { product: "the apartment" }),
      "Nhân viên định giá": m("finance_legal", "property valuer", { doc: "the valuation report" }),
      "Quản lý bất động sản": m("support", "property manager", { item: "your apartment" }, { customers: ["tenant", "người thuê"] }),
    },
  },
  agriculture: {
    fallback: m("engineering", "agricultural worker", { site: "the farm", equipment: "the irrigation system" }),
    positions: {
      "Nông dân": m("engineering", "farmer", { site: "the farm", equipment: "the irrigation system" }),
      "Kỹ sư nông nghiệp": m("engineering", "agricultural engineer", { site: "the farm", equipment: "the irrigation system" }),
      "Kỹ sư chăn nuôi": m("engineering", "livestock engineer", { site: "the farm", equipment: "the feeding system" }),
      "Bác sĩ thú y": m("healthcare", "vet", { place: "the vet clinic" }, { customers: ["pet owner", "chủ vật nuôi"] }),
      "Nhân viên nuôi trồng thủy sản": m("engineering", "aquaculture technician", { site: "the fish farm", equipment: "the water pump" }),
      "Quản lý trang trại": m("engineering", "farm manager", { site: "the farm", equipment: "the irrigation system" }),
    },
  },
  energy_environment: {
    fallback: m("engineering", "energy engineer", { site: "the plant", equipment: "the equipment" }),
    positions: {
      "Kỹ sư điện": m("engineering", "electrical engineer", { site: "the plant", equipment: "the transformer" }),
      "Kỹ sư năng lượng": m("engineering", "energy engineer", { site: "the plant", equipment: "the solar panels" }),
      "Kỹ sư môi trường": m("engineering", "environmental engineer", { site: "the plant", equipment: "the treatment system" }),
      "Nhân viên xử lý chất thải": m("engineering", "waste treatment operator", { site: "the plant", equipment: "the treatment system" }),
      "Nhân viên an toàn lao động": m("operations", "safety officer", { unit: "the site" }),
    },
  },
  design_art: {
    fallback: m("creative", "designer"),
    positions: {
      "Nhà thiết kế đồ họa": m("creative", "graphic designer"),
      "Nhà thiết kế thời trang": m("creative", "fashion designer", { work: "the collection" }),
      "Nhà thiết kế nội thất": m("creative", "interior designer", { work: "the interior design" }),
      "Nhiếp ảnh gia": m("creative", "photographer", { work: "the photos" }),
      "Quay phim": m("creative", "camera operator", { work: "the video" }),
      "Biên tập viên video": m("creative", "video editor", { work: "the video" }),
      "Họa sĩ": m("creative", "artist", { work: "the painting" }),
      "Diễn viên": m("creative", "actor", { work: "the scene" }),
      "Ca sĩ": m("creative", "singer", { work: "the performance" }),
      "Đạo diễn": m("creative", "director", { work: "the film" }),
    },
  },
  fashion_beauty: {
    fallback: m("hospitality", "beauty specialist", { place: "the salon", service: "the treatment" }),
    positions: {
      "Nhân viên tư vấn thời trang": m("sales", "fashion consultant", { product: "this collection" }),
      "Chuyên viên trang điểm": m("hospitality", "makeup artist", { place: "the salon", service: "the makeup" }),
      "Thợ làm tóc": m("hospitality", "hairdresser", { place: "the salon", service: "the haircut" }),
      "Nhân viên spa": m("hospitality", "spa therapist", { place: "the spa", service: "the massage" }),
      "Chuyên viên chăm sóc da": m("hospitality", "skincare specialist", { place: "the spa", service: "the facial" }),
      "Nhân viên nail": m("hospitality", "nail technician", { place: "the salon", service: "the manicure" }),
    },
  },
  science: {
    fallback: m("research", "researcher"),
    positions: {
      "Nhà nghiên cứu khoa học": m("research", "research scientist"),
      "Trợ lý nghiên cứu": m("research", "research assistant"),
      "Nhà hóa học": m("research", "chemist", { project: "the experiment" }),
      "Nhà sinh học": m("research", "biologist"),
      "Nhân viên phòng thí nghiệm": m("research", "lab assistant", { project: "the experiment" }),
      "Chuyên viên R&D": m("research", "R&D specialist", { project: "the new product" }),
    },
  },
  public_sector: {
    fallback: m("office", "civil servant", { doc: "the application form" }),
    positions: {
      "Công chức": m("office", "civil servant", { doc: "the application form" }),
      "Cán bộ hành chính": m("office", "administrative officer", { doc: "the application form" }),
      "Cán bộ ngoại giao": m("office", "diplomat", { doc: "the agenda" }),
      "Cán bộ thuế": m("finance_legal", "tax officer", { doc: "the tax return" }),
      "Cán bộ hải quan": m("finance_legal", "customs officer", { doc: "the customs declaration" }),
      "Chuyên viên chính sách": m("office", "policy officer", { doc: "the policy draft" }),
    },
  },
  security: {
    fallback: m("operations", "security officer"),
    positions: {
      "Sĩ quan quân đội": m("operations", "military officer", { unit: "the unit" }),
      "Quân nhân": m("operations", "soldier", { unit: "the unit" }),
      "Công an": m("operations", "police officer", { unit: "the station" }),
      "Cảnh sát": m("operations", "police officer", { unit: "the patrol" }),
      "Nhân viên bảo vệ": m("operations", "security guard", { unit: "the building" }, { customers: ["visitor", "khách"] }),
      "Nhân viên cứu hộ": m("operations", "rescue worker", { unit: "the rescue team" }),
    },
  },
  sports: {
    fallback: m("education", "sports coach", { class: "the training session" }, { customers: ["trainee", "học viên"] }),
    positions: {
      "Vận động viên": m("education", "athlete", { class: "the training session" }, { customers: ["teammate", "đồng đội"] }),
      "Huấn luyện viên thể thao": m("education", "sports coach", { class: "the training session" }, { customers: ["athlete", "vận động viên"] }),
      "Huấn luyện viên cá nhân": m("education", "personal trainer", { class: "the workout" }, { customers: ["client", "khách tập"] }),
      "Giáo viên thể dục": m("education", "PE teacher", { class: "the PE class" }),
      "Trọng tài": m("education", "referee", { class: "the match" }, { customers: ["player", "cầu thủ"] }),
      "Nhân viên phòng gym": m("hospitality", "gym staff", { place: "the gym", service: "the membership" }, { customers: ["member", "hội viên"] }),
    },
  },
  ngo: {
    fallback: m("office", "project officer", { doc: "the project proposal" }),
    positions: {
      "Nhân viên dự án": m("office", "project officer", { doc: "the project proposal" }),
      "Điều phối viên dự án": m("office", "project coordinator", { doc: "the project plan" }),
      "Nhân viên phát triển cộng đồng": m("office", "community development officer", { doc: "the project report" }),
      "Chuyên viên gây quỹ": m("office", "fundraising officer", { doc: "the funding proposal" }),
      "Nhân viên đối ngoại": m("office", "external relations officer", { doc: "the meeting agenda" }),
    },
  },
  telecom: {
    fallback: m("tech", "telecom engineer", { system: "the network" }),
    positions: {
      "Kỹ sư viễn thông": m("tech", "telecom engineer", { system: "the network" }),
      "Kỹ sư điện tử": m("tech", "electronics engineer", { system: "the circuit board" }),
      "Kỹ thuật viên mạng": m("engineering", "network technician", { site: "the customer's office", equipment: "the router" }),
      "Kỹ thuật viên sửa chữa điện tử": m("engineering", "electronics repair technician", { site: "the workshop", equipment: "the device" }),
    },
  },
  personal_services: {
    fallback: m("household", "domestic helper"),
    positions: {
      "Người giúp việc": m("household", "domestic helper"),
      "Bảo mẫu": m("household", "nanny"),
      "Nhân viên chăm sóc trẻ em": m("household", "childcare worker"),
      "Nhân viên chăm sóc người cao tuổi": m("household", "elderly caregiver"),
      "Nhân viên vệ sinh": m("household", "cleaner"),
      "Nhân viên giặt ủi": m("household", "laundry worker"),
    },
  },
  other: {
    fallback: m("office", "staff member"),
    positions: {},
  },
};
