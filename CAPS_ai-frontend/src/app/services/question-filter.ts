import type { Category, Question } from '../models/question.model';
export type QuestionFilter = 'All' | Question['status'];
export function filterQuestions(questions: readonly Question[], search: string, status: QuestionFilter, category: 'All' | Category = 'All'): Question[] {
  const term=search.trim().toLocaleLowerCase();
  return questions.filter(q=>(status==='All'||q.status===status)&&(category==='All'||(q.category||'General')===category)&&
    (!term||[q.name,q.organization,q.questionText].some(value=>value.toLocaleLowerCase().includes(term))));
}
