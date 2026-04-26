import { db } from '../database/src/client.js';
import { workflowDefinitions } from '../database/src/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const workflowId = '87dc20ed-c857-431c-9349-ce84ab5dda01';
  const row = db.select().from(workflowDefinitions).where(eq(workflowDefinitions.id, workflowId)).get();
  
  if (!row) {
    console.error('Workflow not found');
    return;
  }

  const nodes = JSON.parse(row.nodesJson);
  
  // Check if video node already exists
  if (nodes.find(n => n.type === 'generate_video')) {
    console.log('Video node already exists');
    return;
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

  db.update(workflowDefinitions)
    .set({ nodesJson: JSON.stringify(nodes) })
    .where(eq(workflowDefinitions.id, workflowId))
    .run();

  console.log('Updated workflow with video node');
}

main().catch(console.error);
