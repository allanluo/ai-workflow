import sqlite3
import json
import sys

def main():
    conn = sqlite3.connect('./database/data/ai-workflow.sqlite')
    c = conn.cursor()
    
    workflow_id = '87dc20ed-c857-431c-9349-ce84ab5dda01'
    c.execute('SELECT nodes_json FROM workflow_definitions WHERE id = ?', (workflow_id,))
    row = c.fetchone()
    
    if not row:
        print('Workflow not found')
        sys.exit(1)
        
    nodes = json.loads(row[0])
    
    for n in nodes:
        if n.get('type') in ['generate_video', 'video']:
            print('Video node already exists')
            sys.exit(0)
            
    nodes.append({
        'id': 'generate_video-vtest',
        'type': 'generate_video',
        'params': {
            'prompt': 'A cinematic video of Allan crawling through the grass.',
            'width': 1024,
            'height:': 576,
            'bypass': False
        },
        'data': {
            'label': 'Generate Video',
            'catalog_type': 'video_generation',
            'category': 'generation',
            'graph_position': { 'x': 400, 'y': 600 }
        }
    })
    
    c.execute('UPDATE workflow_definitions SET nodes_json = ? WHERE id = ?', (json.dumps(nodes), workflow_id))
    conn.commit()
    print('Updated workflow with video node')

if __name__ == '__main__':
    main()
