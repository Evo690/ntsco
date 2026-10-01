import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
const context=createContext({escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
runInContext(await readFile(new URL('../src/features/charts.js',import.meta.url),'utf8'),context);
test('chart inputs distinguish missing values from a real zero and reject invalid numbers',()=>{
  for(const value of [undefined,null,'',' ',true,[],{},Infinity,'NaN']) assert.equal(context.chartNumber(value),null);
  assert.equal(context.chartNumber(0),0);assert.equal(context.chartNumber('42'),42);
  assert.equal(context.chartPercent(0,100),0);assert.equal(context.chartPercent(10,0),null);
  assert.equal(context.chartPercent(-5,100),-5);
});
test('question chart uses actual counts and accepts API spelling aliases',()=>{
  const chart=context.buildOutcomeChart({totalCorrect:10,totalIncorrect:5,totalUnattempted:5});
  assert.match(chart,/Correct 10, Incorrect 5, Unattempted 5/);assert.match(chart,/>20<\/text>/);
  assert.doesNotMatch(chart,/NaN|Infinity/);
});
test('missing question counts do not silently become zero or a fabricated chart',()=>{
  for(const result of [{},{totalCorrect:10},{totalCorrect:0,totalIncorrect:0,totalUnattempted:0}]){
    const chart=context.buildOutcomeChart(result);assert.match(chart,/aren’t available/);assert.doesNotMatch(chart,/<svg/);
  }
});
test('subject bars clamp drawing dimensions while retaining exact marks and escaping labels',()=>{
  const chart=context.buildSubjectChart({subjectData:[{subjectName:'<Physics>',totalMarks:-4,totalSubjectMarks:100},{subjectName:'Extra credit',totalMarks:110,totalSubjectMarks:100},{subjectName:'Unknown',totalMarks:null,totalSubjectMarks:100}]});
  assert.match(chart,/width:0%/);assert.match(chart,/width:100%/);assert.match(chart,/-4/);assert.match(chart,/&lt;Physics>/);assert.doesNotMatch(chart,/Unknown/);
});
