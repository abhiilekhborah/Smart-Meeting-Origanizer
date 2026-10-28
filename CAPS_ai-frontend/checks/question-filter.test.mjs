import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterQuestions} from '../src/app/services/question-filter.ts';
const questions=[
  {questionId:1,name:'Rahul',organization:'ABC College',questionText:'How does FIFO work?',status:'Pending'},
  {questionId:2,name:'Priya',organization:'Design team',questionText:'Are simultaneous requests safe?',status:'Answered'},
  {questionId:3,name:'RAHUL',organization:'Computer Science',questionText:'Where are records saved?',status:'Answered'},
  {questionId:4,name:'Amit',organization:'ABC College',questionText:'Withdraw me',status:'Withdrawn'}
];
test('search by participant name ignores case and surrounding whitespace',()=>assert.deepEqual(filterQuestions(questions,' rahul ','All').map(q=>q.questionId),[1,3]));
test('search by organization',()=>assert.deepEqual(filterQuestions(questions,'college','All').map(q=>q.questionId),[1,4]));
test('search by question keyword',()=>assert.deepEqual(filterQuestions(questions,'SIMULTANEOUS','All').map(q=>q.questionId),[2]));
test('filter by each question status',()=>{for(const status of ['Pending','Speaking','Answered','Withdrawn'])assert.deepEqual(filterQuestions(questions,'',status),questions.filter(q=>q.status===status));});
test('combine search and status',()=>assert.deepEqual(filterQuestions(questions,'rahul','Answered').map(q=>q.questionId),[3]));
test('search misses return no matches',()=>assert.deepEqual(filterQuestions(questions,'nothing matches','All'),[]));
test('all filter and clear search preserve FIFO order without mutating records',()=>{
  const before=JSON.stringify(questions);assert.deepEqual(filterQuestions(questions,'','All').map(q=>q.questionId),[1,2,3,4]);assert.equal(JSON.stringify(questions),before);
});

 test('category filter combines with status/search without changing FIFO',()=>{
  const categorized=questions.map((q,i)=>({...q,category:i%2?'Technical':'General'}));
  assert.deepEqual(filterQuestions(categorized,'','All','Technical').map(q=>q.questionId),categorized.filter(q=>q.category==='Technical').map(q=>q.questionId));
  assert.deepEqual(filterQuestions(categorized,'','Pending','General').map(q=>q.questionId),categorized.filter(q=>q.category==='General'&&q.status==='Pending').map(q=>q.questionId));
 });
