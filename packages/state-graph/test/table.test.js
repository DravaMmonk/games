import { withProgressFixture } from '../../qed/test/fixture.js'
// The table board as content and saves hold it: blueprint text both ways, fitting a board to its task, the checks on
// a board that becomes a part; reading a course leaves its content as it was; a save of a level's
// stages moves to its tasks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepFreeze } from '../../../games/kit/engine/content.js';
import { plainBoard } from '../../circuit/core/contracts.js'
import { print, read } from '../../circuit/core/board/text.js'
import { readLines } from 'circuit'
import { workshopView } from '../../workshop/core/workshop-view.js'
import { tableWorks as prepareWorks } from '../../table/core/work.js';
const tableWorks = content => prepareWorks(content.tableWorlds ? content : { ...content, tableWorlds: WORLDS });
import { fitted, portsProblem } from '../../table/core/model/board.js'
import { modelOf } from '../../table/core/model/run.js'
import { partsOf } from '../../table/core/model/parts.js'
import { restoreRobotBoard } from '../../table/core/model/robot-wiring.js'
import { robotBlueprint, wiring } from '../../table/core/model/wiring.js'
import { WORLDS } from '../core/model/worlds.js';
import { inspectRobotCase, robotConstraint } from '../../table/core/model/verdict.js';
import { validate } from '../../table/core/validate.js';

const given = { offers: { view: ['up', 'left'], facts: ['start', 'rock'] }, inputs: [], outs: ['cell'] };

const model = modelOf(partsOf({}));
const world = {
  sensors: { up: { type: 'kernel/number' }, left: { type: 'kernel/number' }, start: { type: 'kernel/boolean' }, rock: { type: 'kernel/boolean' } },
  outs: [['cell', 'Cell', '', 'kernel/number']],
};
const blueprint = robotBlueprint(model, given, world);

test('blueprint text reads into a board and writes back the same', () => {
  const lines = ['m = table/msum(view.up, view.left)', 'k = table/const[value=1]()', 'g = table/pass(facts.start, k)', 's = table/msum(m, g)', 'cell <- s'];
  const b = blueprint.read(lines);
  assert.deepEqual(b.nodes.find(n => n.id === 'view').params.picks, ['up', 'left']);
  assert.deepEqual(b.nodes.find(n => n.id === 'facts').params.picks, ['start']);
  assert.deepEqual(b.nodes.find(n => n.id === 'k').params, { value: 1 });
  assert.deepEqual(b.wires.find(w => w.to === 'cell'), { from: 's', to: 'cell', port: 'in' });
  const written = blueprint.write(b);
  assert.deepEqual(written.slice(0, 2), ['view[picks=[up, left]]()', 'facts[picks=[start]]()']);
  const restored = blueprint.read(written);
  assert.deepEqual(plainBoard(restored), plainBoard(b));
  assert.deepEqual(blueprint.write(restored), written);
});

test('robot blueprints refuse a second wire, sink sources and unavailable sensor settings', () => {
  assert.throws(() => blueprint.read(['m = table/msum(view.down)', 'cell <- m']), e => e.line === 1 && /has no output “down”/.test(e.en));
  assert.throws(() => blueprint.read(['cell <- view.up', 'cell <- view.left']), e => e.line === 2 && /takes two wires/.test(e.en));
  assert.throws(() => blueprint.read(['m = table/mmin(cell)']), e => e.line === 1 && /has no output/.test(e.en));
  assert.throws(() => blueprint.read(['view[picks=up]()']), e => e.line === 1 && /must be a list/.test(e.en));
  assert.throws(() => blueprint.read(['view[picks=[down]]()']), e => e.line === 1 && /down/.test(e.en));
  assert.throws(() => blueprint.read(['cell <- facts.start']), e => e.line === 1 && /bool|yes/i.test(e.en));
  const withUnused = blueprint.read(['view[picks=[left, up]]()', 'cell <- view.up']);
  assert.deepEqual(withUnused.nodes[0].params.picks, ['up', 'left']);
  assert.deepEqual(blueprint.read(blueprint.write(withUnused)), withUnused);
});

test('a grouped merger stays available to blueprints under each unlocked model', () => {
  const content = twoLevels();
  content.registries.tag['circuit/part:circuit/primitives'].values.push('table/mmin');
  content.levels[0].adds.push('table/mmin');
  const course = tableWorks(deepFreeze(withProgressFixture(content)));
  assert.deepEqual(course.wrong, []);
  const [task] = course.played.get('build');
  const { shown, folded, types } = course.offerIn(task, new Set());
  assert.deepEqual([...shown, ...folded].filter((type) => type === 'table/msum' || type === 'table/mmin'), ['table/msum']);
  assert.deepEqual(types.filter((type) => type === 'table/msum' || type === 'table/mmin'), ['table/msum', 'table/mmin']);
  const start = fitted({ nodes: [], wires: [] }, task.given);
  const parts = wiring(course.model, { ...WORLDS[task.world], offers: task.given.offers });
  const board = readLines(['m = table/mmin(view.up, view.left)', 'cell <- m'], start, parts, types);
  assert.equal(board.nodes.find((node) => node.id === 'm')?.type, 'table/mmin');
  assert.throws(() => readLines(['m = table/mmax(view.up)'], start, parts, types), (error) => error.line === 1 && /not available/.test(error.en));
});

test('a fitted board reads each sensor on the card that offers it, and drops what its task lacks', () => {
  const b = {
    nodes: [{ id: 'view', type: 'view', params: { picks: ['left', 'start', 'gone'] }, x: 5, y: 6 }, { id: 'm', type: 'table/msum' }, { id: 'old', type: 'out' }],
    wires: [{ from: 'view#start', to: 'm', port: '0' }, { from: 'view#gone', to: 'm', port: '1' }, { from: 'm', to: 'old', port: 'in' }],
  };
  const f = fitted(b, given);
  assert.deepEqual(f.nodes.map(n => n.id), ['view', 'facts', 'cell', 'm']);
  assert.deepEqual(f.nodes[0], { id: 'view', type: 'view', params: { picks: ['left'] }, x: 5, y: 6 });
  assert.deepEqual(f.nodes[1].params.picks, ['start']);
  assert.deepEqual(f.wires, [{ from: 'facts#start', to: 'm', port: '0' }]);
});

test('a board that becomes a part reads exactly its ports', () => {
  const ports = [{ sensor: 'up', label: 'up' }, { sensor: 'left', label: 'left' }, { input: 'way3', label: 'way in 3' }];
  const read = robotBlueprint(model, { ...given, inputs: ['way3'] }, world).read;
  assert.equal(portsProblem(read(['m = table/mmin(view.up, view.left, way3)', 'cell <- m']), ports), null);
  const readsSensor = blueprint.read(['cell <- view.up']);
  assert.equal(robotConstraint({ ports: [], taskId: 'example' }, readsSensor), null);
  assert.ok(robotConstraint({ ports: [], taskId: 'example', builds: { task: 'example' } }, readsSensor));
  assert.match(String(portsProblem(read(['m = table/mmin(view.up, view.left)', 'cell <- m']), ports)), /way in 3|来路|way3/);
  assert.match(String(portsProblem(read(['m = table/mmin(view.up, view.left, way3)', 'gate = table/pass(facts.rock, m)', 'cell <- gate']), ports)), /rock/);
});

// A course of two levels written here: the first builds a route counter, the second runs it behind a block gate.
const t = s => ({ zh: s, en: s });
const counterSolution = ['k = table/const[value=1]()', 'g = table/pass(facts.start, k)', 'm = table/msum(view.up, view.left, g)', 'cell <- m'];
const counterPorts = [{ 'state-graph/way': { n: 1, sensor: 'up' } }, { 'state-graph/way': { n: 2, sensor: 'left' } }, { 'state-graph/start': { sensor: 'start' } }];
const twoLevels = () => ({
  id: 't', title: t('t'), registries: { tag: { 'circuit/part:circuit/primitives': { kind: 'circuit/part', values: ['table/msum', 'table/const', 'table/pass', 'table/block'] } } },
  partDefs: { parts: { counter: { name: t('counter'), desc: t('d'), inputs: [{ name: 'up', type: 'kernel/number' }, { name: 'left', type: 'kernel/number' }, { name: 'start', type: 'kernel/boolean' }], outputType: 'kernel/number', inside: [{ id: 'base', reference: { play: 'state-graph/circuit', world: 'state-graph/grid', robot: 'state-graph/scout', facts: ['start'], solution: counterSolution, ports: counterPorts } }] } } },
  eras: [{ id: 'e', machine: 'state-graph/scout', levels: [{ id: 'build' }, { id: 'reuse' }], links: [{ from: 'build', to: 'reuse' }], chapter: { title: t('e'), desc: t('e') } }],
  levels: [
    { id: 'build', intro: [], robot: 'state-graph/scout', adds: ['table/msum', 'table/const', 'table/pass'],
      tasks: [{ id: 'build', publishes: [{ part: 'counter', variant: 'base' }], play: 'state-graph/circuit', world: 'state-graph/grid', facts: ['start'], ports: counterPorts, tests: [{ R: 3, C: 4 }], expected: [10], solution: counterSolution }] },
    { id: 'reuse', intro: [], robot: 'state-graph/scout', adds: ['table/block'],
      tasks: [{ id: 'reuse', play: 'state-graph/circuit', world: 'state-graph/grid', facts: ['start', 'rock'],
        tests: [{ R: 4, C: 4, rocks: [[1, 1]] }, { R: 4, C: 5, rocks: [[1, 2], [2, 0]] }, { R: 5, C: 5, rocks: [[1, 3], [2, 1], [3, 3]] }], expected: [8, 12, 10],
        solution: ['c = counter(view.up, view.left, facts.start)', 'b = table/block(facts.rock, c)', 'cell <- b'] }] },
  ],
});

test('a robot circuit checks its declared interface against its referenced world', () => {
  const wrongInput = twoLevels();
  wrongInput.partDefs.parts.counter.inputs[0].type = 'kernel/boolean';
  assert.ok(tableWorks(wrongInput).wrong.some(message => message.includes('input types do not match')));
  const wrongOutput = twoLevels();
  wrongOutput.partDefs.parts.counter.outputType = 'kernel/boolean';
  assert.ok(tableWorks(wrongOutput).wrong.some(message => message.includes('output type does not match')));
});

test('a robot runs a packaged circuit without a local publishing task', () => {
  const content = twoLevels();
  content.levels[0].tasks[0].publishes = [];
  content.levels[0].adds.push('counter');
  const table = tableWorks(content);
  const task = table.played.get('reuse')[0];
  const result = table.run(WORLDS[task.world], task.tests[0], task.solution, task);
  assert.deepEqual(table.wrong, []);
  assert.equal(result.value, task.expected[0]);
});

test('a configurable robot part opens and runs the same setting, including its default', () => {
  const content = twoLevels();
  content.partDefs.parts.counter.settings = { value: { control: 'number', default: 2 } };
  const { model, played, syncOwn } = tableWorks(content);
  const builder = played.get('build')[0];
  const reuse = played.get('reuse')[0];
  // The passing board may hold a different value from the one the enclosing card declares.
  syncOwn({ build: { ...builder.solution, nodes: builder.solution.nodes.map(node => node.id === 'k' ? { ...node, params: { value: 4 } } : node) } });
  const part = model.built.counter.part;
  for (const [params, value] of [[{}, 2], [{ value: 3 }, 3], [{ value: 0 }, 0]]) {
    const graph = { ...reuse.solution, nodes: reuse.solution.nodes.map(node => node.id === 'c' ? { ...node, params } : node) };
    const run = model.runCircuit(WORLDS[reuse.world], reuse.tests[0], graph, reuse);
    assert.equal(run.value, reuse.expected[0] * value);
    assert.equal(part.board(params).nodes.find(node => node.id === 'k').params.value, value);
  }
});

test('robot workshop blueprints round-trip and restore with the same ports and signal checks', () => {
  const table = tableWorks(twoLevels());
  const task = table.played.get('reuse')[0];
  const V = WORLDS[task.world];
  const base = { partOf: table.model.partOf, board: {
    ticks: true,
    wiring: (_, view) => wiring(table.model, { sensors: V.sensors, outs: V.outs, offers: task.given.offers, workshop: view.workshop }),
  } };
  const part = {
    id: 'user_value', graph: { nodes: [], wires: [] }, inputs: [], outputs: ['cell'],
    outputSignals: { cell: 'kernel/number' }, name: 'Saved value',
  };
  const viewFor = (definition) => workshopView(base, { parts: { [part.id]: definition } }, () => true, table.model.partOf).view;
  const view = viewFor(part);
  const parts = view.board.wiring(task);
  const opening = fitted({ nodes: [], wires: [] }, task.given);
  const source = `p = ${part.id}()\ncell <- p`;
  const { graph, errors } = read(source, opening, parts, [part.id]);
  assert.equal(errors, undefined);
  assert.deepEqual(plainBoard(read(print(graph, parts), opening, parts, [part.id]).graph), plainBoard(graph));
  assert.deepEqual(plainBoard(restoreRobotBoard(table.model, task, graph, { knows: view.partOf, parts })), plainBoard(graph));
  assert.match(read(`p = ${part.id}[value=2]()`, opening, parts, [part.id]).errors[0].en, /has no setting/);
  const other = viewFor({ ...part, outputSignals: { cell: 'kernel/boolean' } });
  assert.equal(restoreRobotBoard(table.model, task, graph, { knows: other.partOf, parts: other.board.wiring(task) }), null);
});

test('the parts box lists only choices open on its selected robot', () => {
  const content = twoLevels();
  content.levels[0].tasks[0].consts = [1, 2];
  content.levels[1].robot = 'state-graph/ranger';
  content.levels[1].adds.push('table/mmin');
  content.levels[1].tasks[0].consts = [3];
  const table = tableWorks(withProgressFixture(content));
  const values = (type, options) => table.settingsIn(type, { flags: new Set(), open: () => true, ...options })[0]?.values.map(({ value }) => value);
  assert.deepEqual(values('table/msum', { scope: 'state-graph/scout' }), ['table/msum']);
  assert.deepEqual(values('table/msum', { scope: 'state-graph/ranger' }), ['table/msum', 'table/mmin']);
  assert.deepEqual(values('table/const', { scope: 'state-graph/scout' }), [1, 2]);
  assert.deepEqual(values('table/const', { scope: 'state-graph/ranger' }), [3]);
  assert.equal(values('table/msum', { scope: 'state-graph/ranger', open: () => false }), undefined);
});

test('carried boards use the reference until the prerequisite has passed', async () => {
  const content = twoLevels();
  content.levels[1].carry = 'build';
  const table = tableWorks(content), source = table.played.get('build')[0], target = table.played.get('reuse')[0];
  const modified = { ...source.solution, nodes: source.solution.nodes.map(n => n.id === 'k' ? { ...n, params: { value: 7 } } : n) };
  const progress = { all: true, passed: [], solved: [], data: { build: modified }, built: {} };
  assert.equal(table.opening(target, progress).nodes.find(n => n.id === 'k').params.value, 1);
  const passed = { ...progress, passed: ['build'], built: { build: modified } };
  assert.equal(table.opening(target, passed).nodes.find(n => n.id === 'k').params.value, 7);
});

function cellCourse(publish = false) {
  const solution = ['value = table/const[value=4]()', 'zero = table/const[value=0]()', 'start = table/pass(facts.start, zero)', 'sum = table/msum(value, start)', 'cell <- sum'];
  const different = solution.map(line => line.replace('zero = table/const[value=0]', 'zero = table/const[value=1]'));
  const reference = {
    play: 'state-graph/circuit', world: 'state-graph/grid', robot: 'state-graph/scout', facts: ['start'],
    ports: [{ 'state-graph/start': { sensor: 'start' } }],
  };
  const task = { ...reference, id: 'cells', tests: [{ R: 2, C: 2 }], expected: [4], solution, checkAll: true };
  const parts = {};
  if (publish) {
    task.publishes = [{ part: 'first', variant: 'base' }];
    parts.first = {
      name: t('First'), desc: t('Changes the first cell.'),
      inputs: [{ name: 'start', type: 'kernel/boolean' }], outputType: 'kernel/number',
      inside: [{ id: 'base', reference: { ...reference, solution: different } }],
    };
  } else task.naive = different;
  return {
    id: 'cells', title: t('Cells'), partDefs: { parts },
    eras: [{ id: 'e', levels: [{ id: 'cells' }], chapter: { title: t('Cells') } }],
    levels: [{ id: 'cells', robot: 'state-graph/scout', intro: [], tasks: [task] }],
  };
}

test('author checks can reject a robot board whose final answer is correct', () => {
  const table = tableWorks(deepFreeze(cellCourse()));
  assert.deepEqual(table.wrong, []);
  const [task] = table.played.get('cells');
  for (const traced of [true, false]) {
    const report = inspectRobotCase(table.run, task, task.naive, 0, { traced });
    assert.equal(report.res.value, 4);
    assert.equal(report.ok, false);
    assert.deepEqual(report.mm, { q: 0, z: 0, want: 4, got: 5 });
  }
  assert.deepEqual(validate({ levels: table.LEVELS, table }), [{ text: '2 runs' }]);
  const endpoint = { ...table, played: new Map([['cells', [{ ...task, checkAll: false }]]]) };
  assert.deepEqual(validate({ levels: table.LEVELS, table: endpoint }), [
    { level: 'cells', fail: true, text: 'cells: its naive board passes every test' },
    { text: '2 runs' },
  ]);
});

test('a packed robot board must fill the same cells as its publishing reference', () => {
  const table = tableWorks(cellCourse(true));
  assert.deepEqual(table.wrong, []);
  const [builder] = table.played.get('cells');
  let referenceRuns = 0;
  const run = (...args) => {
    if (args[2] === builder.solution) referenceRuns++;
    return table.run(...args);
  };
  assert.deepEqual(validate({ levels: table.LEVELS, table: { ...table, run } }), [
    { level: 'cells', fail: true, text: "cells: its part fills the table differently from the level's board on test 1" },
    { text: '2 runs' },
  ]);
  assert.equal(referenceRuns, 1);
});

test('the robot check reports incorrect and missing authored answers', () => {
  const course = cellCourse();
  course.levels[0].tasks[0].expected = [5];
  const table = tableWorks(course);
  assert.deepEqual(validate({ levels: table.LEVELS, table }), [
    { level: 'cells', fail: true, text: 'cells test 1: the reference gives 4, expected 5' },
    { text: '2 runs' },
  ]);
  course.levels[0].tasks[0].expected = [];
  assert.deepEqual(tableWorks(course).wrong, ['cells: gives 0 expected answers for 1 tests']);
});

test('a built part runs the board its level’s last task was passed with, when that board reads exactly the part’s ports', async () => {
  const { WORLDS } = await import('../core/model/worlds.js');
  const { played, wrong, syncOwn, run } = tableWorks(twoLevels());
  assert.deepEqual(wrong, []);
  const builder = played.get('build').at(-1), user = played.get('reuse').at(-1);
  const V = WORLDS[user.world], answers = () => user.tests.map(t => run(V, t, user.solution, user).value);
  const offByOne = { ...builder.solution, nodes: builder.solution.nodes.map(n => (n.type === 'table/const' ? { ...n, params: { value: 2 } } : n)) };
  const noStart = { ...builder.solution, wires: builder.solution.wires.filter(w => w.from !== 'facts#start') };
  assert.deepEqual(answers(), user.expected, 'the written answers are the routes around the rocks');
  syncOwn({ build: offByOne });
  assert.notDeepEqual(answers(), user.expected);
  // Another read of the same content keeps boards of its own: the first read's kept board is not its part.
  const other = tableWorks(twoLevels()), otherUser = other.played.get('reuse').at(-1);
  assert.deepEqual(otherUser.tests.map(t => other.run(V, t, otherUser.solution, otherUser).value), otherUser.expected);
  assert.notDeepEqual(answers(), user.expected);
  // As an older save keeps it: no output node, every sensor on the view card.
  const unfitted = { nodes: builder.solution.nodes.filter(n => n.type !== 'out').map(n => (n.type === 'facts' ? null : n.type === 'view' ? { ...n, params: { picks: ['up', 'left', 'start'] } } : n)).filter(Boolean), wires: builder.solution.wires.map(w => (w.from === 'facts#start' ? { ...w, from: 'view#start' } : w)) };
  syncOwn({ build: { ...unfitted, nodes: unfitted.nodes.map(n => (n.type === 'table/const' ? { ...n, params: { value: 2 } } : n)) } });
  assert.notDeepEqual(answers(), user.expected);
  syncOwn({ build: unfitted });
  assert.deepEqual(answers(), user.expected);
  syncOwn({ build: noStart });
  assert.deepEqual(answers(), user.expected);
  const stalePort = { ...offByOne, wires: [...offByOne.wires, { from: 'facts#start', to: 'cell', port: 'gone' }] };
  syncOwn({ build: stalePort });
  assert.deepEqual(answers(), user.expected);

});
