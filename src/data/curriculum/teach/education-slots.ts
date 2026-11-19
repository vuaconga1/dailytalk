import type { DayPack } from "@/domain/curriculum/types";
import { day } from "./lesson";
import { SHARED_DAYS } from "./shared-days";

/** Day 25 cannot reuse "on my desk": that phrase is already in the education cluster. */
const lateWork = day({
  title: "Talk about late work",
  situation: "Nói với {person_vi} về bài nộp muộn trong {class}",
  skill: "politeness",
  focus: "Nhắc bài muộn rõ hạn",
  goal: "Nói bài còn thiếu, hạn ngày mai và chỗ để bài",
  words: [
    ["late paper", "leɪt ˈpeɪpɚ", "n", "bài nộp muộn"],
    ["bring it tomorrow", "brɪŋ ɪt təˈmɑroʊ", "phr", "mang đến vào ngày mai"],
    ["still due", "stɪl du", "phr", "vẫn còn đến hạn"],
    ["missing work", "ˈmɪsɪŋ wɝk", "n", "bài còn thiếu"],
    ["by the door", "baɪ ðə dɔr", "phr", "để cạnh cửa"],
  ],
  frames: [
    { en: "This late paper is …", vi: "Bài nộp muộn này thì …", structure: "This late paper is + tính từ", usage: "Mở chuyện bài muộn không nặng lời. Is đi với trạng thái của bài." },
    { en: "Please bring it tomorrow …", vi: "Hãy mang đến vào ngày mai …", structure: "Please bring it tomorrow + thời điểm", usage: "Đặt hạn mới. Tomorrow có thể thêm buổi, như morning." },
    { en: "It is still due, so …", vi: "Bài vẫn đến hạn, vì vậy …", structure: "It is still due, so + mệnh đề", usage: "Nhấn bài chưa được bỏ. So nối với việc học sinh cần làm." },
    { en: "Put the missing work …", vi: "Để bài còn thiếu …", structure: "Put the missing work + by the door", usage: "Nói chỗ nộp. By the door là cạnh cửa lớp." },
  ],
  lines: [
    "I forgot the paper.",
    "This late paper is still due.",
    "When do you need it?",
    "Please bring it tomorrow morning.",
    "Is it too late?",
    "It is still due, so I can accept it tomorrow.",
    "Where do I put it?",
    "Put the missing work by the door.",
  ],
});

/** Student lessons that replace adult education days when that purpose is off. */
export const educationStudentSlots: DayPack = {
  15: SHARED_DAYS[15],
  16: SHARED_DAYS[16],
  17: SHARED_DAYS[17],
  18: SHARED_DAYS[18],
  19: SHARED_DAYS[19],
  20: SHARED_DAYS[20],
  21: SHARED_DAYS[21],
  25: lateWork,
  27: SHARED_DAYS[27],
};
