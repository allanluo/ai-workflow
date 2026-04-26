import Database from 'better-sqlite3';

const db = new Database('./database/data/ai-workflow.sqlite');
const workflowId = '87dc20ed-c857-431c-9349-ce84ab5dda01';

const row = db.prepare('SELECT nodes_json FROM workflow_definitions WHERE id = ?').get(workflowId);
if (!row) {
  console.error('Workflow not found');
  process.exit(1);
}

const nodes = JSON.parse(row.nodes_json);
if (nodes.find(n => n.type === 'generate_video' || n.type === 'video')) {
  console.log('Video node already exists');
  process.exit(0);
}

nodes.push({
  id: 'generate_video-vtest',
  type: 'generate_video',
  params: {
    prompt: 'A cinematic video of Allan crawling through the grass.',
    width: 1024,
    height: 576,
    bypass: false
  },
  data: {
    label: 'Generate Video',
    catalog_type: 'video_generation',
    category: 'generation',
    graph_position: { x: 400, y: 600 }
  }
});

db.prepare('UPDATE workflow_definitions SET nodes_json = ? WHERE id = ?').run(JSON.stringify(nodes), workflowId);
console.log('Updated workflow with video node');
