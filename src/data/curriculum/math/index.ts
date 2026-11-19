import type { Cluster } from "@/domain/curriculum/types";
import { makeTrack } from "../teach/make-track";
import { SUBJECTS } from "../teach/subjects";

const preschool = makeTrack(SUBJECTS.mathPreschool);
const primary = makeTrack(SUBJECTS.mathPrimary);
const lowerSecondary = makeTrack(SUBJECTS.mathLower);
const upperSecondary = makeTrack(SUBJECTS.mathUpper);

export const math: Cluster = {
  id: "math",
  label: "Giảng dạy Toán",
  summary: "giảng bài, giao bài và trao đổi về môn Toán với học sinh, phụ huynh, đồng nghiệp và quản lý",
  people: {
    customers: ["student", "học sinh"],
    partners: ["parent", "phụ huynh"],
    managers: ["academic manager", "quản lý học thuật"],
    colleagues: ["colleague", "đồng nghiệp"],
  },
  vars: { class: "the class", grade: "grade 8" },
  days: lowerSecondary.days,
  tracks: {
    preschool,
    primary,
    lower_secondary: lowerSecondary,
    upper_secondary: upperSecondary,
  },
};
