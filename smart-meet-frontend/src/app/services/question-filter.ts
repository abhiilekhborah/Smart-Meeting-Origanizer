import type { Question } from '../models/question.model';
export type QuestionFilter = 'All' | Question['status'];
// Array.filter preserves the API's SubmittedAt / QuestionId order. Never sort by votes.
export function filterQuestions(questions: readonly Question[], search: string, status: QuestionFilter): Question[] {
  const term = search.trim().toLocaleLowerCase();
  return questions.filter(q => (status === 'All' || q.status === status) &&
    (!term || [q.name, q.organization, q.questionText].some(value => value.toLocaleLowerCase().includes(term))));
}
