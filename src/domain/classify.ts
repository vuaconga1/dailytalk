import { profileLabels, type ProfileInput } from "@/domain/profile";
import { levelInfo, shiftLevel } from "@/domain/profile-options";
import type { Classification, SkillId } from "@/domain/types";

export const SKILL_LABELS: Record<SkillId, string> = {
  reflex: "Phản xạ nghe – nói",
  vocabulary: "Từ vựng theo công việc",
  pronunciation: "Phát âm rõ ràng",
  structure: "Mẫu câu nền tảng",
  fluency: "Diễn đạt trôi chảy, mạch lạc",
  politeness: "Diễn đạt lịch sự, chuyên nghiệp",
  listening: "Nghe hiểu người bản ngữ",
};

/** [skill, weight, reason] contributed by each goal / audience. */
const GOAL_SKILLS: Record<string, [SkillId, number, string][]> = {
  meetings: [["reflex", 2, "họp cần phản hồi nhanh khi người khác hỏi"], ["listening", 1, "cần nắm ý chính trong cuộc họp"]],
  phone: [["listening", 3, "gọi điện không có cử chỉ, khẩu hình để hỗ trợ nghe"], ["pronunciation", 2, "qua điện thoại phát âm cần rõ"]],
  presentation: [["fluency", 3, "thuyết trình cần nói liền mạch, có cấu trúc"], ["pronunciation", 1, "người nghe cần hiểu ngay"]],
  small_talk: [["reflex", 2, "xã giao diễn ra nhanh và tự nhiên"], ["listening", 1, "cần bắt kịp chủ đề thay đổi"]],
  customer_service: [["politeness", 3, "làm việc với khách cần cách nói lịch sự, đúng mực"], ["vocabulary", 1, "cần thuật ngữ về sản phẩm, dịch vụ"]],
  negotiation: [["politeness", 2, "đàm phán cần mềm mỏng mà vẫn rõ ràng"], ["fluency", 2, "cần trình bày lập luận mạch lạc"]],
  interview: [["fluency", 2, "phỏng vấn cần kể kinh nghiệm mạch lạc"], ["structure", 1, "câu trả lời cần đúng cấu trúc"]],
  messaging: [["structure", 2, "tin nhắn, email cần câu đúng và rõ"], ["vocabulary", 1, "cần cụm từ chuẩn trong công việc"]],
};

const AUDIENCE_SKILLS: Record<string, [SkillId, number, string][]> = {
  customers: [["politeness", 2, "bạn giao tiếp với khách hàng"]],
  partners: [["politeness", 1, "bạn làm việc với đối tác"], ["vocabulary", 1, "trao đổi với đối tác cần từ chuyên ngành"]],
  managers: [["fluency", 1, "báo cáo cấp trên cần ngắn gọn, rõ ý"]],
  colleagues: [["reflex", 1, "trao đổi hằng ngày với đồng nghiệp"]],
  recruiters: [["fluency", 1, "bạn cần gây ấn tượng với nhà tuyển dụng"]],
  travel: [["listening", 1, "đi công tác gặp nhiều giọng nói khác nhau"]],
};

const LEVEL_SUMMARY: Record<string, string> = {
  starter: "Lộ trình bắt đầu từ câu ngắn và từ vựng gắn với công việc, mỗi ngày nói được vài câu hoàn chỉnh.",
  elementary: "Lộ trình giúp bạn ghép câu nhanh hơn, dùng mẫu câu có sẵn để trao đổi những việc quen thuộc.",
  intermediate: "Lộ trình tập trung mở rộng câu trả lời, xử lý tình huống phát sinh và nói tự nhiên hơn.",
  upper: "Lộ trình tập trung cách diễn đạt chuyên nghiệp, tinh tế và xử lý tình huống khó.",
};

/**
 * No placement test: the starting level combines the self-reported level with how often
 * English is used. Real session results adjust it from day 1 (see working_level).
 */
export function classify(input: ProfileInput): Classification {
  const level = input.frequency === "rarely" && input.self_level !== "starter" ? shiftLevel(input.self_level, -1) : input.self_level;
  const info = levelInfo(level);
  const labels = profileLabels(input);

  // Weights add up per skill; the reason shown is the one with the largest single weight.
  const scores = new Map<SkillId, { weight: number; why: string; best: number }>();
  const add = (skill: SkillId, weight: number, why: string) => {
    const cur = scores.get(skill) ?? { weight: 0, why, best: 0 };
    scores.set(skill, { weight: cur.weight + weight, why: weight > cur.best ? why : cur.why, best: Math.max(cur.best, weight) });
  };
  if (level === "starter" || level === "elementary") {
    add("structure", 3, "nền câu chắc giúp bạn nói được ngay từ những ngày đầu");
    add("vocabulary", 2, `cần vốn từ cốt lõi cho vị trí ${labels.position}`);
  } else {
    add("vocabulary", 1, `từ vựng chuyên sâu hơn cho ${labels.industry}`);
  }
  if (input.frequency === "rarely" || input.frequency === "monthly") {
    add("reflex", 2, "bạn ít có dịp dùng tiếng Anh nên phản xạ cần được luyện đều mỗi ngày");
  }
  for (const g of input.goals) for (const [s, w, why] of GOAL_SKILLS[g] ?? []) add(s, w, why);
  for (const a of input.audiences) for (const [s, w, why] of AUDIENCE_SKILLS[a] ?? []) add(s, w, why);

  const priorities = [...scores.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 3)
    .map(([skill, { why }]) => ({ skill, label: SKILL_LABELS[skill], why_vi: why.charAt(0).toUpperCase() + why.slice(1) }));

  const adjusted = level !== input.self_level ? ` Vì bạn hầu như chưa dùng tiếng Anh, buổi đầu sẽ bắt đầu nhẹ hơn một bậc.` : "";
  return {
    level,
    level_label: info.label,
    summary_vi: `${info.label}: ${info.description} ${LEVEL_SUMMARY[level]}${adjusted} Trình độ sẽ được điều chỉnh theo kết quả thật sau mỗi buổi học.`,
    priorities,
  };
}
