/**
 * Create (or reset) a realistic sample learner for product demos.
 *
 *   npm run seed:demo
 *   npm run seed:demo -- --email x@y.z --password secret123
 *
 * Dates are relative to today (Asia/Ho_Chi_Minh), so re-run before each demo to keep
 * the history fresh and today's lesson untouched.
 */
import bcrypt from "bcryptjs";
import { classify } from "../src/lib/classify";
import { LESSONS } from "../src/lib/content";
import { buildPlan } from "../src/lib/curriculum";
import { framesUsed } from "../src/lib/frames";
import type { ProfileInput } from "../src/lib/profile";
import { prisma } from "../src/lib/prisma";
import { shiftDays, vnDate } from "../src/lib/time";
import type { LearnerProfile, LevelSignal, StudyPlan, Summary, Turn } from "../src/lib/types";

const NAME = "Nguyễn Minh Anh";
const ACCOUNTS: [email: string, password: string][] = [
  ["minhanh.nguyen@wewin.edu.vn", "WeWIN2026"],
  // Same learner data, short password for live demos.
  ["demo@wewin.edu.vn", "123"],
];

const INPUT: ProfileInput = {
  industry: "sales",
  industry_other: "",
  position: "nhan_vien_kinh_doanh",
  position_other: "",
  audiences: ["customers", "partners", "managers"],
  goals: ["meetings", "phone", "presentation"],
  self_level: "elementary",
  frequency: "weekly",
  study_time: "20:30",
  timezone: "Asia/Ho_Chi_Minh",
  reminders: true,
};
const classification = classify(INPUT);
const PROFILE: LearnerProfile = { ...INPUT, classification, working_level: classification.level };

// Lesson actually studied in each seeded session (with the day's focus).
const SESSION_LESSONS: [lessonId: string, focus: string][] = [
  ["L01", "Tự giới thiệu ngắn gọn, chuyên nghiệp"],
  ["L11", "Giới thiệu vai trò và dự án đang phụ trách"],
  ["L03", "Xin nhắc lại, xác nhận thông tin khi nghe chưa rõ"],
  ["L12", "Đề xuất và chốt lịch họp với đối tác"],
  ["L04", "Hẹn gặp, đổi giờ hẹn lịch sự"],
  ["L13", "Báo cáo việc đã hoàn thành và việc còn lại"],
  ["L02", "Mô tả lịch làm việc hằng ngày"],
  ["L14", "Yêu cầu tài liệu và xác nhận thời hạn"],
  ["L05", "Nêu ý kiến, lựa chọn kèm lý do"],
  ["L06", "Nhờ đồng nghiệp hỗ trợ"],
  ["L11", "Ôn tập: giới thiệu với khách hàng mới"],
  ["L12", "Ôn tập: dời lịch họp và đề xuất giờ khác"],
  ["L13", "Ôn tập: cập nhật tiến độ có số liệu"],
  ["L14", "Ôn tập: theo dõi email và tài liệu còn thiếu"],
  ["L03", "Ôn tập: làm rõ yêu cầu qua điện thoại"],
  ["L04", "Ôn tập: xác nhận cuộc hẹn qua điện thoại"],
  ["L05", "Ôn tập: so sánh hai phương án cho khách"],
  ["L06", "Ôn tập: xin hỗ trợ khi gặp sự cố"],
  ["L01", "Ứng dụng: mở đầu buổi gặp khách hàng"],
  ["L11", "Ứng dụng: giới thiệu dịch vụ công ty"],
  ["L12", "Ứng dụng: lên lịch họp nhiều bên"],
  ["L13", "Ứng dụng: báo cáo với quản lý nước ngoài"],
  ["L14", "Ứng dụng: yêu cầu báo giá và hợp đồng"],
  ["L02", "Ứng dụng: small talk đầu cuộc họp"],
  ["L03", "Ứng dụng: xử lý khi khách nói nhanh"],
  ["L04", "Ứng dụng: sắp xếp buổi demo dịch vụ"],
  ["L05", "Ứng dụng: tư vấn gói dịch vụ phù hợp"],
  ["L13", "Tổng ôn: cập nhật tiến độ dự án"],
  ["L12", "Tổng ôn: chốt lịch và gửi xác nhận"],
  ["L11", "Tổng kết: tự tin thuyết trình 1 phút về công việc"],
];

const PLAN: StudyPlan = {
  goal: "Sau 30 buổi, Minh Anh chủ động giới thiệu bản thân và dịch vụ, đặt lịch họp, báo cáo tiến độ và yêu cầu tài liệu với đối tác quốc tế một cách lưu loát, lịch sự.",
  days: buildPlan(PROFILE).days,
};
const SIGNALS: LevelSignal[] = ["match", "match", "below", "match", "match", "match", "match", "match", "match", "match", "match", "match"];

type Line = string | [text: string, mode: "voice" | "text"];
type Session = {
  talk: Line[];
  overview: string;
  strengths: string[];
  improvements: string[];
  next_step: string;
  status: Summary["goal_status"];
};

// Completed sessions: conversation (coach/learner alternate, first line is the coach) + feedback.
const SESSIONS: Session[] = [
  {
    talk: [
      "Hello! What's your name?",
      ["Hello, my name is Minh Anh. Nice to meet you.", "voice"],
      "Nice to meet you too, Minh Anh. Where do you work?",
      ["I work in an office. I work for a logistics company in Ho Chi Minh City.", "voice"],
      "Great! What do you do there?",
      ["I am sales executive. I talk with customers every day.", "voice"],
      'Good! Small tip: we say "I am a sales executive." Do you enjoy your job?',
      ["Yes, I enjoy my job because I meet many interesting people.", "voice"],
      "Wonderful. That was a clear introduction. Well done today!",
    ],
    overview:
      "Minh Anh tự giới thiệu được tên, nơi làm việc và vai trò bằng câu hoàn chỉnh. Phản xạ trả lời nhanh, nội dung rõ ràng và có thông tin cụ thể.",
    strengths: [
      "Dùng đúng mẫu câu “My name is… / I work in…”",
      "Bổ sung chi tiết về công ty và thành phố làm việc",
      "Nêu lý do tự nhiên với “because”",
    ],
    improvements: ["Nhớ dùng mạo từ trước nghề nghiệp: “I am a sales executive.”", "Nối các ý ngắn bằng “and”, “so” để câu liền mạch hơn"],
    next_step: "Tự giới thiệu lại trong 30 giây, thêm một câu về nhóm khách hàng bạn thường làm việc.",
    status: "achieved",
  },
  {
    talk: [
      "Welcome to the team. What do you do?",
      ["Thank you. I'm responsible for new customers in the south region.", "voice"],
      "That sounds important. Which project are you working on?",
      ["I'm working on a warehouse service for an electronics company.", "voice"],
      "Interesting! How long have you worked on it?",
      ["About two months. We start the service next month.", "voice"],
      "Great. Who do you work with on this project?",
      ["I work with the operations team and one manager from Singapore.", "voice"],
      "Excellent. You explained your role very clearly.",
    ],
    overview:
      "Buổi học tốt. Minh Anh giới thiệu được vai trò, dự án đang phụ trách và người cùng làm việc. Câu trả lời ngắn gọn, đúng ngữ cảnh công sở.",
    strengths: [
      "Dùng chính xác “I'm responsible for…”",
      "Mô tả dự án với thì hiện tại tiếp diễn “I'm working on…”",
      "Trả lời đủ ý cho từng câu hỏi",
    ],
    improvements: [
      "Dùng “We will start” hoặc “We are starting” khi nói kế hoạch tháng sau",
      "Thêm một câu về lợi ích của dự án cho khách hàng",
    ],
    next_step: "Chuẩn bị 3 câu giới thiệu dự án hiện tại để dùng trong cuộc họp tuần tới.",
    status: "achieved",
  },
  {
    talk: [
      "Please meet me at the main entrance.",
      ["Sorry, could you repeat that, please?", "voice"],
      "Sure. At the main entrance, near the cafe, at two thirty.",
      ["Two thirty? Could you speak more slowly, please?", "voice"],
      "Of course. Two... thirty... in the afternoon.",
      ["Thank you. So I meet you at the main entrance at 2:30 pm.", "voice"],
      "That's right. Do you know where the cafe is?",
      ["Yes, I know. It is near the reception.", "text"],
      "Perfect. See you there!",
    ],
    overview:
      "Minh Anh chủ động xin nhắc lại và xác nhận lại thông tin quan trọng (giờ, địa điểm). Đây là kỹ năng rất cần khi gọi điện với đối tác.",
    strengths: ["Xin nhắc lại lịch sự với “Could you repeat that, please?”", "Tóm tắt lại thông tin để xác nhận"],
    improvements: [
      "Dùng “So, I'll meet you…” khi xác nhận lịch hẹn",
      "Luyện thêm cách hỏi nghĩa từ: “What do you mean by…?”",
      "Tăng số lượt nói bằng giọng thay vì nhập chữ",
    ],
    next_step: "Nghe lại đoạn mẫu ở tốc độ 1× và nói theo câu xin nhắc lại 3 lần không nhìn chữ.",
    status: "needs_review",
  },
  {
    talk: [
      "Could we schedule a meeting for Tuesday?",
      ["Sure. Is ten o'clock good for you?", "voice"],
      "Ten is a little early for me. How about eleven?",
      ["Eleven is fine. Could you send me the details?", "voice"],
      "Of course. Should we meet online or in the office?",
      ["I prefer online because my customer is in Hanoi.", "voice"],
      "Good idea. I will send you a meeting link.",
      ["Thank you. I will confirm with my customer today.", "voice"],
      "Great. You handled the scheduling very well!",
    ],
    overview:
      "Minh Anh đề xuất giờ họp, linh hoạt đổi giờ và chủ động xin thông tin chi tiết. Cuộc hội thoại tự nhiên, đúng phong cách công sở.",
    strengths: ["Đề xuất giờ họp rõ ràng", "Xử lý tốt khi đối tác đổi giờ", "Dùng “I will confirm…” để chốt việc tiếp theo"],
    improvements: ["Thử thêm cách nói “Does eleven work for you?”", "Nhắc lại ngày và giờ cuối cùng để tránh nhầm lẫn"],
    next_step: "Viết và đọc to một câu xác nhận lịch họp: “Just to confirm, we'll meet online on Tuesday at 11 a.m.”",
    status: "achieved",
  },
  {
    talk: [
      "Are you available tomorrow?",
      ["Yes, I am available in the afternoon.", "voice"],
      "What time would you like to meet?",
      ["Could we meet at three o'clock?", "voice"],
      "Three is fine. Where should we meet?",
      ["Let's meet at our office on Nguyen Hue street.", "voice"],
      "Sounds good. Should I bring anything?",
      ["Please bring your company profile. Thank you.", "voice"],
      "Sure. See you tomorrow at three!",
    ],
    overview:
      "Minh Anh hẹn lịch gặp trọn vẹn: thời gian, địa điểm và tài liệu cần chuẩn bị. Phát âm các mốc giờ rõ ràng, câu đề nghị lịch sự.",
    strengths: ["Dùng “Could we meet at…?” tự nhiên", "Gợi ý địa điểm cụ thể với “Let's…”", "Chủ động nhờ đối tác chuẩn bị tài liệu"],
    improvements: ["Kết thúc bằng một câu xác nhận lại toàn bộ lịch hẹn"],
    next_step: "Luyện nói một tin nhắn thoại 20 giây hẹn gặp khách hàng vào tuần sau.",
    status: "achieved",
  },
  {
    talk: [
      "How is the project going?",
      ["It is going well. I've completed the price proposal.", "voice"],
      "Great. What do you still need to do?",
      ["I still need to check the report and send the contract.", "voice"],
      "When will you finish?",
      ["I think I will finish before Friday.", "voice"],
      "Do you need any help?",
      ["Maybe I need help from the finance team for the contract.", "voice"],
      "Good. Thanks for the clear update!",
    ],
    overview:
      "Minh Anh báo cáo tiến độ rõ ràng: việc đã xong, việc còn lại, thời hạn và nhu cầu hỗ trợ. Đây là cấu trúc báo cáo chuẩn khi làm việc với quản lý.",
    strengths: [
      "Dùng đúng thì hiện tại hoàn thành “I've completed…”",
      "Nêu rõ việc còn lại với “I still need to…”",
      "Chủ động đề cập nhu cầu hỗ trợ",
    ],
    improvements: ["Thay “Maybe I need” bằng “I might need” để tự nhiên hơn", "Thêm số liệu cụ thể (ví dụ: 80% completed)"],
    next_step: "Chuẩn bị bản cập nhật tiến độ 3 câu cho công việc thật của bạn tuần này.",
    status: "achieved",
  },
  {
    talk: [
      "What time do you start work?",
      ["I usually start work at eight thirty.", "voice"],
      "What do you usually do in the morning?",
      ["I check emails and call customers.", "voice"],
      "When do you finish work?",
      ["I usually finish at six, but sometimes later.", "voice"],
      "What do you do after work?",
      ["I go to the gym and study English for fifteen minutes.", "voice"],
      "That's a great routine! Well done.",
    ],
    overview: "Minh Anh mô tả lịch làm việc mạch lạc với trạng từ chỉ tần suất. Câu nói trôi chảy hơn rõ rệt so với tuần đầu.",
    strengths: ["Dùng “usually”, “sometimes” đúng vị trí", "Kể hoạt động theo trình tự thời gian", "Câu trả lời đầy đủ, tự nhiên"],
    improvements: ["Thêm từ nối “After that”, “Then” khi kể trình tự"],
    next_step: "Kể lịch làm việc của ngày mai trong 4 câu, dùng “first, then, after that, finally”.",
    status: "achieved",
  },
  {
    talk: [
      "Could you send me the document?",
      ["Certainly. Which document do you need?", "voice"],
      "The shipping schedule for March, please.",
      ["No problem. When do you need it?", "voice"],
      "By this afternoon, if possible.",
      ["I will send it before three o'clock. Could you also send me the order list?", "voice"],
      "Sure, I'll email it to you now.",
      ["Thank you. Please check the file and let me know if you have questions.", "voice"],
      "Perfect. Very professional!",
    ],
    overview:
      "Minh Anh vừa đáp ứng yêu cầu tài liệu vừa chủ động yêu cầu ngược lại. Ngôn ngữ lịch sự, phù hợp email và điện thoại công việc.",
    strengths: [
      "Hỏi rõ tài liệu và thời hạn",
      "Đưa ra cam kết cụ thể “before three o'clock”",
      "Dùng cụm câu chuyên nghiệp “let me know if you have questions”",
    ],
    improvements: ["Luyện thêm cách nói “I'll get back to you by…”"],
    next_step: "Áp dụng cụm “Could you send me… by…?” trong một email thật hôm nay.",
    status: "achieved",
  },
  {
    talk: [
      "Do you prefer meeting in person or online?",
      ["I prefer meeting in person because it is easier to build trust.", "voice"],
      "That's a good point. When do you prefer online meetings?",
      ["When the customer is far away, I prefer online to save time.", "voice"],
      "Which tool do you usually use?",
      ["We usually use Zoom, but some customers prefer Teams.", "voice"],
      "Interesting. Thanks for sharing your opinion!",
    ],
    overview: "Minh Anh nêu quan điểm rõ ràng kèm lý do thuyết phục, biết so sánh hai lựa chọn theo từng tình huống.",
    strengths: ["Dùng mẫu “I prefer… because…” chính xác", "Lý do cụ thể, gắn với công việc thật", "Biết đưa ra ngữ cảnh “When…”"],
    improvements: ["Thử dùng “I'd rather…” để đa dạng cách diễn đạt"],
    next_step: "So sánh hai gói dịch vụ của công ty bạn bằng 3 câu “I prefer… because…”.",
    status: "achieved",
  },
  {
    talk: [
      "Excuse me. Could you help me find the meeting room?",
      ["Of course. It's on the third floor, next to the elevator.", "voice"],
      "Thank you. Is the projector working?",
      ["I'm not sure. Could you help me check it, please?", "voice"],
      "Sure. It works now. Anything else?",
      ["Could you help me print ten copies of this agenda?", "voice"],
      "No problem. I'll bring them in five minutes.",
      ["Thank you so much for your help.", "voice"],
      "You're welcome. Good luck with your meeting!",
    ],
    overview: "Minh Anh vừa chỉ đường vừa nhờ hỗ trợ một cách lịch sự, xử lý linh hoạt nhiều yêu cầu trong cùng một tình huống.",
    strengths: [
      "Dùng “Could you help me…?” đúng và lịch sự",
      "Mô tả vị trí rõ ràng “on the third floor, next to…”",
      "Cảm ơn tự nhiên, phù hợp văn hóa công sở",
    ],
    improvements: ["Thêm câu mềm hóa: “Sorry to bother you, but…”"],
    next_step: "Luyện 3 câu nhờ hỗ trợ bạn hay dùng ở văn phòng, bắt đầu bằng “Sorry to bother you, but…”.",
    status: "achieved",
  },
  {
    talk: [
      "Hello, I'm David from Lumi Electronics. What do you do?",
      ["Nice to meet you, David. I'm Minh Anh, a sales executive at WeShip Logistics.", "voice"],
      "Nice to meet you. What are you responsible for?",
      ["I'm responsible for warehouse and delivery services for electronics customers.", "voice"],
      "Which projects are you working on now?",
      ["We're working on a fast delivery service in Ho Chi Minh City and Hanoi.", "voice"],
      "Sounds interesting. Could we talk more next week?",
      ["Sure. I'll send you an email to arrange a meeting.", "voice"],
      "Great. Looking forward to it!",
    ],
    overview:
      "Buổi ôn tập rất tốt. Minh Anh giới thiệu bản thân, công ty và dịch vụ trôi chảy như một cuộc gặp khách hàng thật, đồng thời chủ động đề xuất bước tiếp theo.",
    strengths: [
      "Giới thiệu đầy đủ tên, chức danh và công ty trong một câu",
      "Mô tả dịch vụ cụ thể, đúng thuật ngữ",
      "Chủ động chốt bước tiếp theo",
    ],
    improvements: ["Thêm một câu nêu lợi ích nổi bật của dịch vụ cho khách hàng"],
    next_step: "Chuẩn bị “elevator pitch” 30 giây giới thiệu dịch vụ của công ty.",
    status: "achieved",
  },
  {
    talk: [
      "Hi Minh Anh, I'm sorry, but I can't make our meeting on Thursday.",
      ["No problem. Could we schedule it for Friday morning instead?", "voice"],
      "Friday morning is busy. What about Friday afternoon?",
      ["Friday at two o'clock works for me. Does it work for you?", "voice"],
      "Yes, two o'clock is perfect.",
      ["Great. I will update the invitation and send you the new details.", "voice"],
      "Thank you. Should we invite your manager?",
      ["Yes, I will invite my manager because she can answer questions about pricing.", "voice"],
      "Excellent. See you on Friday!",
    ],
    overview: "Minh Anh xử lý tình huống dời lịch họp chuyên nghiệp: đề xuất giờ thay thế, xác nhận lại với đối tác và cập nhật lời mời.",
    strengths: [
      "Đề xuất lịch thay thế ngay lập tức",
      "Dùng “Does it work for you?” rất tự nhiên",
      "Giải thích lý do mời thêm người tham dự",
    ],
    improvements: ["Nhắc lại ngày giờ cuối cùng: “So, Friday at 2 p.m.”"],
    next_step: "Buổi tới: cập nhật tiến độ dự án có số liệu cụ thể.",
    status: "achieved",
  },
];

/** 20:34–20:40 Vietnam time on `date`. */
function eveningOf(date: string, minute: number): Date {
  return new Date(`${date}T20:${String(34 + minute).padStart(2, "0")}:00+07:00`);
}

async function seed(email: string, password: string) {
  const today = vnDate();
  const n = SESSIONS.length;
  // Two missed days early on, then an unbroken streak up to yesterday.
  const dates = SESSIONS.map((_, k) => shiftDays(today, -(n - k + (k >= 3 ? 0 : 2))));

  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: {
      email,
      name: NAME,
      passwordHash: await bcrypt.hash(password, 10),
      profile: PROFILE,
      plan: PLAN,
      planSource: "curriculum",
      status: "ACTIVE",
      packageName: "Gói 30 ngày",
      activatedAt: new Date(`${shiftDays(today, -(n + 3))}T09:00:00+07:00`),
      accessEndsAt: new Date(`${shiftDays(today, 30 - n)}T23:59:59+07:00`),
    },
  });

  for (const [i, s] of SESSIONS.entries()) {
    const turns: Turn[] = s.talk.map((t) =>
      typeof t === "string" ? { role: "assistant", text: t } : { role: "user", text: t[0], input_mode: t[1] },
    );
    const said = turns.filter((t) => t.role === "user");
    const lesson = LESSONS[SESSION_LESSONS[i][0]];
    const used = framesUsed(
      lesson.frames,
      said.map((t) => t.text),
    );
    const summary: Summary = {
      overview: s.overview,
      strengths: s.strengths,
      improvements: s.improvements,
      next_step: s.next_step,
      goal_status: s.status,
      evidence: said.slice(1, 3).map((t) => t.text),
      errors: i === 0 ? [{ issue: "Thiếu mạo từ trước nghề nghiệp", example: said[2].text, correction: "I am a sales executive." }] : [],
      review_items: i === 2 ? ["Could you repeat that, please?", "So, I'll meet you at…"] : [],
      mode: "openai",
      frames_used: lesson.frames.filter((_, k) => used[k]),
      turn_count: said.length,
      voice_turns: said.filter((t) => t.input_mode === "voice").length,
      pronunciation_note: "",
      level_signal: SIGNALS[i] ?? "match",
    };
    const planned = PLAN.days[i].title;
    const started = eveningOf(dates[i], i % 7);
    await prisma.attempt.create({
      data: {
        userId: user.id,
        day: i + 1,
        localDate: dates[i],
        lesson,
        plannedTitle: planned,
        selectedBy: lesson.title === planned ? "plan" : "rule",
        focus: SESSION_LESSONS[i][1],
        wordsDone: true,
        shadowDone: true,
        completed: true,
        summary,
        practice: {
          create: {
            userId: user.id,
            startedAt: started,
            deadline: new Date(started.getTime() + 300_000),
            ended: true,
            turns,
          },
        },
      },
    });
  }
  console.log(
    `Đã tạo học viên mẫu: ${NAME}\n  Email:    ${email}\n  Mật khẩu: ${password}\n  ${n} buổi đã hoàn thành, buổi ${n + 1} sẵn sàng hôm nay.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = flag("email");
  const password = flag("password");
  if (email || password) {
    if (!email || !password) throw new Error("Cần cả --email và --password.");
    await seed(email.trim().toLowerCase(), password);
  } else {
    for (const [e, p] of ACCOUNTS) await seed(e, p);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
