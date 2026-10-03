import test from 'node:test';
import assert from 'node:assert/strict';
import { latestProjectTasks, legacyTaskFromProject, normalizeProjectTask, PROJECT_TASK_HEADERS } from '../api/_handlers/projects.js';
import { projectTaskSummary, quotationTaskCandidates } from '../src/components/projectTasks.js';

test('project task store has independent project and task identifiers', () => {
  assert.ok(PROJECT_TASK_HEADERS.includes('Task ID'));
  assert.ok(PROJECT_TASK_HEADERS.includes('Project ID'));
  assert.ok(PROJECT_TASK_HEADERS.includes('Quotation Line ID'));
});

test('latest task history returns one current row per task', () => {
  const rows = [
    { 'Task ID': 'T-1', Status: 'Not Started' },
    { 'Task ID': 'T-2', Status: 'In Progress' },
    { 'Task ID': 'T-1', Status: 'Completed' },
  ];
  const latest = latestProjectTasks(rows);
  assert.equal(latest.length, 2);
  assert.equal(latest.find(row => row['Task ID'] === 'T-1').Status, 'Completed');
});

test('completion updates progress and completion date', () => {
  const completed = normalizeProjectTask({ Status: 'Completed', 'Progress %': 30 }, {}, {}, '2026-10-03');
  assert.equal(completed['Progress %'], 100);
  assert.equal(completed['Completion Date'], '2026-10-03');
  const reopened = normalizeProjectTask({ ...completed, Status: 'In Progress' }, completed, {}, '2026-10-04');
  assert.equal(reopened['Completion Date'], '');
  assert.equal(reopened['Progress %'], 99);
});

test('legacy project task is exposed without rewriting project history', () => {
  const task = legacyTaskFromProject({
    'Project ID (unique, auto-generated)': 'PRJ-1', 'Project Name': 'Track Build',
    'Task Name': 'Site survey', 'Task Owner': 'Ravi',
    'Task Status (Not Started / In Progress / Completed)': 'In Progress',
  });
  assert.equal(task['Task ID'], 'LEGACY-PRJ-1');
  assert.equal(task['Project ID'], 'PRJ-1');
  assert.equal(task['Task Name'], 'Site survey');
  assert.equal(task['Source Type'], 'Legacy Project Task');
});

test('quotation rows become selectable task candidates without commercial mutation', () => {
  const quote = { quoteId: 'Q-1', revision: 3 };
  const payload = { items: [{ displayItem: 'Sub-grade preparation', descHtml: '<p>Prepare <b>base</b></p>', qty: 6600, unit: 'SQM', rate: 340 }] };
  const candidates = quotationTaskCandidates(quote, payload);
  assert.deepEqual(candidates[0], {
    quotationLineId: 'Q-1:item:0', taskName: 'Sub-grade preparation', item: 'Sub-grade preparation',
    description: 'Prepare base', quantity: 6600, unit: 'SQM', quoteId: 'Q-1', quoteRevision: 3,
  });
  assert.equal(payload.items[0].rate, 340);
});

test('project task summary reports completion and progress', () => {
  const summary = projectTaskSummary([
    { Status: 'Completed', 'Progress %': 100 },
    { Status: 'In Progress', 'Progress %': 50 },
  ]);
  assert.deepEqual(summary, { total: 2, active: 1, completed: 1, overdue: 0, progress: 75 });
});
