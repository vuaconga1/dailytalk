import type { CurriculumDay } from "@/domain/curriculum/types";
import type { Word } from "./lesson";
import { day } from "./lesson";

/** Days 8, 10, 12 and 24. The same headwords in every track; the thread phrase changes. */
export function threadDays(aboutEn: string, aboutVi: string, checkExtra?: Word): Record<number, CurriculumDay> {
  const checkWords: Word[] = [
    ["quick check", "kwɪk tʃɛk", "n", "bài kiểm tra ngắn"],
    ["item one", "ˈaɪtəm wʌn", "n", "câu một"],
    ["item two", "ˈaɪtəm tu", "n", "câu hai"],
    ["write it", "raɪt ɪt", "phr", "viết nó ra"],
    checkExtra ?? ["hand me", "hænd mi", "phr", "đưa cho tôi"],
  ];
  const last = checkExtra ? `Write it and show the ${checkExtra[0]}.` : "Write it and hand me your paper.";
  return {
    8: day({
      title: "Give feedback on the work",
      situation: `Nhận xét bài của {person_vi} về ${aboutVi} trong {class}`,
      skill: "politeness",
      focus: "Khen một phần và chỉ một lỗi nhỏ",
      goal: "Chỉ phần mạnh, một lỗi nhỏ và lời khích lệ làm tốt hơn",
      words: [
        ["clear answer", "klɪr ˈænsɚ", "n", "câu trả lời rõ"],
        ["strong part", "strɔŋ pɑrt", "n", "phần mạnh"],
        ["small slip", "smɔl slɪp", "n", "lỗi nhỏ"],
        ["do better", "du ˈbɛtɚ", "phr", "làm tốt hơn"],
        ["proud of", "praʊd əv", "phr", "tự hào về"],
      ],
      frames: [
        { en: "I like your …", vi: "Tôi thích … của bạn", structure: "I like your + danh từ", usage: "Khen đúng một sản phẩm. Your đi với danh từ." },
        { en: "The strong part is …", vi: "Phần mạnh là …", structure: "The strong part is + danh từ", usage: "Chỉ phần đáng giữ. Is đi với danh từ số ít." },
        { en: "There is one …", vi: "Có một …", structure: "There is one + danh từ", usage: "Nêu một lỗi, không liệt kê nhiều. One đi với danh từ số ít." },
        { en: "You can do better, and …", vi: "Bạn có thể làm tốt hơn, và …", structure: "You can do better, and + mệnh đề", usage: "Khích lệ sau khi chỉ lỗi. And nối với lời tin tưởng." },
      ],
      lines: [
        "Was my work OK?",
        "I like your clear answer.",
        "Which part was good?",
        `The strong part is ${aboutEn}.`,
        "Did I miss something?",
        "There is one small slip.",
        "Should I stop?",
        "You can do better, and I am proud of you.",
      ],
    }),
    10: day({
      title: "Answer a student's question",
      situation: `Trả lời câu hỏi của {person_vi} về ${aboutVi} trong {class}`,
      skill: "listening",
      focus: "Trả lời ngắn và mời hỏi lại",
      goal: "Khen câu hỏi, trả lời ngắn và mời hỏi lại trên lớp",
      words: [
        ["nice question", "naɪs ˈkwɛstʃən", "n", "câu hỏi hay"],
        ["short answer", "ʃɔrt ˈænsɚ", "n", "câu trả lời ngắn"],
        ["because of", "bɪˈkɔz əv", "phr", "vì"],
        ["in class", "ɪn klæs", "phr", "trên lớp"],
        ["ask again", "æsk əˈɡɛn", "phr", "hỏi lại"],
      ],
      frames: [
        { en: "That is a …", vi: "Đó là một …", structure: "That is a + danh từ", usage: "Khen câu hỏi trước khi trả lời. A đi với danh từ số ít." },
        { en: "The short answer is …", vi: "Câu trả lời ngắn là …", structure: "The short answer is + danh từ", usage: "Trả lời gọn một ý. Is đi với ý chính." },
        { en: "It is because of …", vi: "Đó là vì …", structure: "It is because of + danh từ", usage: "Nói lý do bằng danh từ. Because of đi với danh từ, không với mệnh đề." },
        { en: "Please ask again …", vi: "Hãy hỏi lại …", structure: "Please ask again + nơi chốn", usage: "Mời hỏi lại nếu còn vướng. Again đứng sau ask." },
      ],
      lines: [
        "May I ask something?",
        "That is a nice question.",
        "What is the heart of it?",
        `The short answer is ${aboutEn}.`,
        "Why is that true?",
        "It is because of the example.",
        "Can I ask later?",
        "Please ask again in class.",
      ],
    }),
    12: day({
      title: "Set practice for next time",
      situation: `Giao bài luyện về ${aboutVi} cho {person_vi} sau {class}`,
      skill: "structure",
      focus: "Giao bài nhà rõ số lượng",
      goal: "Nói bài tối nay, số câu, trang bắt đầu và lúc mang trả",
      words: [
        ["tonight's task", "təˈnaɪts tæsk", "n", "bài tối nay"],
        ["five items", "faɪv ˈaɪtəmz", "n", "năm câu"],
        ["page one", "peɪdʒ wʌn", "n", "trang một"],
        ["bring back", "brɪŋ bæk", "phr", "mang trả lại"],
        ["next class", "nɛkst klæs", "n", "buổi học sau"],
      ],
      frames: [
        { en: "Tonight's task is about …", vi: "Bài tối nay nói về …", structure: "Tonight's task is about + danh từ", usage: "Giao đúng một bài. About đi với nội dung." },
        { en: "Do five items …", vi: "Làm năm câu …", structure: "Do five items + thời điểm", usage: "Chốt số lượng. Items là các câu hoặc bài nhỏ." },
        { en: "Start at …", vi: "Bắt đầu ở …", structure: "Start at + trang", usage: "Chỉ chỗ bắt đầu trong sách. At đi với trang." },
        { en: "Bring back your work …", vi: "Mang bài trả lại …", structure: "Bring back your work + thời điểm", usage: "Nói lúc nộp lại. Bring back là mang trở lại lớp." },
      ],
      lines: [
        "What should I do tonight?",
        `Tonight's task is about ${aboutEn}.`,
        "How many?",
        "Do five items tonight.",
        "Where do I start?",
        "Start at page one.",
        "When do I return it?",
        "Bring back your work next class.",
      ],
    }),
    24: day({
      title: "Run a short check",
      situation: `Kiểm tra ngắn {person_vi} về ${aboutVi} trong {class}`,
      skill: "vocabulary",
      focus: "Bài kiểm tra hai câu, đúng mức bài đang học",
      goal: "Nói đây là bài kiểm tra ngắn và cách nộp",
      words: checkWords,
      frames: [
        { en: "This is a …", vi: "Đây là một …", structure: "This is a + danh từ", usage: "Báo loại bài trước khi phát đề. A đi với danh từ số ít." },
        { en: "Item one is about …", vi: "Câu một nói về …", structure: "Item one is about + danh từ", usage: "Nói nội dung câu một. About đi với chủ đề." },
        { en: "Item two is …", vi: "Câu hai thì …", structure: "Item two is + tính từ", usage: "Mô tả câu hai rất ngắn. Is đi với tính từ." },
        { en: "Write it and …", vi: "Viết ra và …", structure: "Write it and + động từ nguyên mẫu", usage: "Nói cách nộp sau khi viết. And nối hai việc." },
      ],
      lines: ["Is this a test?", "This is a quick check.", "What is item one?", `Item one is about ${aboutEn}.`, "And item two?", "Item two is a short one.", "Where do I put it?", last],
    }),
  };
}
