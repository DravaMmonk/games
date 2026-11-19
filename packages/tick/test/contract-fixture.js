const task = { id: 'sample/task', play: 'tick/board', brief: 'Hear the line.', listens: true, outputs: [{ name: 'bit', label: 'Bit' }], want: { bit: 'tick/line' }, tests: [{ line: '0101' }], solution: ['bit <- line'], naive: [] }
const content = {
  id: 'sample', title: 'Sample', eras: [], trays: {},
  standalone: { level: 'sample/one' }, glossary: { groups: [], entries: [] },
  partDefs: { parts: {} }, registries: { 'circuit/part': {} },
  levels: [{ id: 'sample/one', title: 'One', tasks: [task] }],
}

export { content, task }
