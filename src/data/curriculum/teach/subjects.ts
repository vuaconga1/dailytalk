import type { GradeId } from "@/domain/curriculum/types";
import type { Word } from "./lesson";

export type SubjectSpec = {
  grade: GradeId;
  className: string;
  gradeLabel: string;
  aboutEn: string;
  aboutVi: string;
  ideaTitle: string;
  ideaSituation: string;
  ideaFocus: string;
  ideaGoal: string;
  words: Word[];
  slots: [string, string, string, string];
  checkExtra?: Word;
};

const idea = (
  partial: Omit<SubjectSpec, "ideaFocus" | "ideaGoal"> & { focus: string; goal: string },
): SubjectSpec => ({
  ...partial,
  ideaFocus: partial.focus,
  ideaGoal: partial.goal,
});

export const SUBJECTS = {
  litPreschool: idea({
    grade: "preschool",
    className: "the story time",
    gradeLabel: "preschool",
    aboutEn: "the kind animal",
    aboutVi: "con vật tốt bụng",
    ideaTitle: "Explain the picture book",
    ideaSituation: "Giải thích sách tranh, nhân vật và vần trong {class} cho {person_vi}",
    focus: "Chỉ tranh, nhân vật, vần, cảm xúc và con rối",
    goal: "Giới thiệu sách tranh bằng một nhân vật, một vần và cảm xúc",
    words: [
      ["picture book", "ˈpɪktʃɚ bʊk", "n", "sách tranh"],
      ["character", "ˈkɛrɪktɚ", "n", "nhân vật"],
      ["rhyme", "raɪm", "n", "vần điệu"],
      ["feeling", "ˈfilɪŋ", "n", "cảm xúc"],
      ["puppet", "ˈpʌpɪt", "n", "con rối"],
    ],
    slots: ["the picture book", "the character", "the rhyme", "the feeling and the puppet"],
  }),
  litPrimary: idea({
    grade: "primary",
    className: "the grade 3 reading class",
    gradeLabel: "grade 3",
    aboutEn: "the whole story",
    aboutVi: "cả câu chuyện",
    ideaTitle: "Explain the story shape",
    ideaSituation: "Giải thích mở đầu, nhân vật, bối cảnh và câu trong {class}",
    focus: "Nói mở đầu, nhân vật, bối cảnh, câu và trang",
    goal: "Chỉ mở đầu câu chuyện, nhân vật, bối cảnh và một câu trên trang",
    words: [
      ["beginning", "bɪˈɡɪnɪŋ", "n", "phần mở đầu"],
      ["character", "ˈkɛrɪktɚ", "n", "nhân vật"],
      ["setting", "ˈsɛtɪŋ", "n", "bối cảnh"],
      ["sentence", "ˈsɛntəns", "n", "câu"],
      ["page", "peɪdʒ", "n", "trang sách"],
    ],
    slots: ["the beginning", "the character", "the setting", "the sentence on the page"],
  }),
  litLower: idea({
    grade: "lower_secondary",
    className: "the grade 8 literature class",
    gradeLabel: "grade 8",
    aboutEn: "the plot and the theme",
    aboutVi: "cốt truyện và chủ đề",
    ideaTitle: "Explain plot, character and theme",
    ideaSituation: "Giải thích cốt truyện, nhân vật, chủ đề, câu trích và đoạn văn trong {class}",
    focus: "Năm từ văn học của bài truyện lớp 8",
    goal: "Nêu cốt truyện, nhân vật, chủ đề, một câu trích và đoạn văn",
    words: [
      ["plot", "plɑt", "n", "cốt truyện"],
      ["character", "ˈkɛrɪktɚ", "n", "nhân vật"],
      ["theme", "θim", "n", "chủ đề"],
      ["quote", "kwoʊt", "n", "câu trích"],
      ["paragraph", "ˈpɛrəˌɡræf", "n", "đoạn văn"],
    ],
    slots: ["the plot", "the character", "the theme", "the quote and the paragraph"],
  }),
  litUpper: idea({
    grade: "upper_secondary",
    className: "the grade 11 literature class",
    gradeLabel: "grade 11",
    aboutEn: "the thesis",
    aboutVi: "luận điểm",
    ideaTitle: "Explain the thesis and the narrator",
    ideaSituation: "Giải thích luận điểm, dẫn chứng, người kể, biểu tượng và giọng điệu trong {class}",
    focus: "Năm từ của đoạn trích lớp 11",
    goal: "Nêu luận điểm, dẫn chứng, người kể, một biểu tượng và giọng điệu",
    words: [
      ["thesis", "ˈθisɪs", "n", "luận điểm"],
      ["evidence", "ˈɛvədəns", "n", "dẫn chứng"],
      ["narrator", "ˈnɛreɪtɚ", "n", "người kể chuyện"],
      ["symbol", "ˈsɪmbəl", "n", "biểu tượng"],
      ["tone", "toʊn", "n", "giọng điệu"],
    ],
    slots: ["the thesis", "the evidence", "the narrator", "the symbol and the tone"],
  }),
  mathPreschool: idea({
    grade: "preschool",
    className: "the counting time",
    gradeLabel: "preschool",
    aboutEn: "counting to five",
    aboutVi: "đếm đến năm",
    ideaTitle: "Explain counting and shapes",
    ideaSituation: "Giải thích đếm, hình tròn, hình vuông, hơn và quy luật trong {class}",
    focus: "Đếm và gọi tên hình",
    goal: "Chỉ cách đếm, hình tròn, hình vuông, hơn và một quy luật",
    words: [
      ["count", "kaʊnt", "v", "đếm"],
      ["circle", "ˈsɝkəl", "n", "hình tròn"],
      ["square", "skwɛr", "n", "hình vuông"],
      ["more than", "mɔr ðæn", "phr", "nhiều hơn"],
      ["pattern", "ˈpætɚn", "n", "quy luật, họa tiết lặp"],
    ],
    slots: ["how to count", "a circle", "a square", "more than one pattern"],
  }),
  mathPrimary: idea({
    grade: "primary",
    className: "the grade 3 math class",
    gradeLabel: "grade 3",
    aboutEn: "adding to twenty",
    aboutVi: "cộng trong phạm vi hai mươi",
    ideaTitle: "Explain adding and subtracting",
    ideaSituation: "Giải thích cộng, trừ, bài toán lời văn, giá trị vị trí và một nửa trong {class}",
    focus: "Cộng trừ và một bài toán lời văn",
    goal: "Chỉ cộng, trừ, bài toán lời văn, giá trị vị trí và một nửa",
    words: [
      ["add", "æd", "v", "cộng"],
      ["subtract", "səbˈtrækt", "v", "trừ"],
      ["word problem", "wɝd ˈprɑbləm", "n", "bài toán lời văn"],
      ["place value", "pleɪs ˈvælju", "n", "giá trị vị trí"],
      ["half", "hæf", "n", "một nửa"],
    ],
    slots: ["how to add", "how to subtract", "a word problem", "the place value of one half"],
  }),
  mathLower: idea({
    grade: "lower_secondary",
    className: "the grade 8 math class",
    gradeLabel: "grade 8",
    aboutEn: "the equation",
    aboutVi: "phương trình",
    ideaTitle: "Explain the equation",
    ideaSituation: "Giải thích phương trình, ẩn, phân số, phần trăm và biểu đồ cột trong {class}",
    focus: "Phương trình và các từ toán lớp 8",
    goal: "Nêu phương trình, ẩn, phân số, phần trăm và biểu đồ cột",
    words: [
      ["equation", "ɪˈkweɪʒən", "n", "phương trình"],
      ["variable", "ˈvɛriəbəl", "n", "ẩn, biến"],
      ["fraction", "ˈfrækʃən", "n", "phân số"],
      ["percent", "pɚˈsɛnt", "n", "phần trăm"],
      ["bar graph", "bɑr ɡræf", "n", "biểu đồ cột"],
    ],
    slots: ["the equation", "the variable", "the fraction", "the percent and the bar graph"],
    checkExtra: ["area", "ˈɛriə", "n", "diện tích"],
  }),
  mathUpper: idea({
    grade: "upper_secondary",
    className: "the grade 11 math class",
    gradeLabel: "grade 11",
    aboutEn: "the function",
    aboutVi: "hàm số",
    ideaTitle: "Explain the function and the graph",
    ideaSituation: "Giải thích hàm số, đồ thị, giao điểm, tập xác định và đường thẳng trong {class}",
    focus: "Hàm số bậc nhất và đồ thị",
    goal: "Nêu hàm số, đồ thị, giao điểm, tập xác định và đường thẳng",
    words: [
      ["function", "ˈfʌŋkʃən", "n", "hàm số"],
      ["graph", "ɡræf", "n", "đồ thị"],
      ["intercept", "ˈɪntɚˌsɛpt", "n", "giao điểm"],
      ["domain", "doʊˈmeɪn", "n", "tập xác định"],
      ["straight line", "streɪt laɪn", "n", "đường thẳng"],
    ],
    slots: ["the function", "the graph", "the intercept", "the domain and the straight line"],
  }),
} satisfies Record<string, SubjectSpec>;
