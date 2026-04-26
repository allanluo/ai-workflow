import urllib.request
import json
import time
import sqlite3

def api_post(url, data=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8') if data else b'{}',
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def api_get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def main():
    base_url = 'http://localhost:3000'
    workflow_id = '87dc20ed-c857-431c-9349-ce84ab5dda01'
    project_id = '58d59254-917c-47aa-b01e-ea453d8e64ee'

    # 1. Freeze new version
    print("Freezing new version...")
    res = api_post(f'{base_url}/api/v1/workflows/{workflow_id}/versions')
    version_id = res['data']['workflow_version']['id']
    print(f"Created version {version_id}")

    # 2. Trigger run 1
    print("Triggering Run 1...")
    res = api_post(f'{base_url}/api/v1/workflow-versions/{version_id}/runs')
    run1_id = res['data']['workflow_run']['id']
    
    # Wait for run to finish (it might take some time, but we'll wait a bit)
    print("Waiting for run 1 to complete...")
    for _ in range(60):
        res = api_get(f'{base_url}/api/v1/workflow-runs/{run1_id}')
        status = res['data']['workflow_run']['status']
        if status in ['completed', 'failed']:
            print(f"Run 1 finished with status {status}")
            break
        time.sleep(2)

    # Check asset count
    conn = sqlite3.connect('./database/data/ai-workflow.sqlite')
    c = conn.cursor()
    c.execute("SELECT count(*) FROM assets WHERE project_id = ? AND asset_type = 'generated_video'", (project_id,))
    count1 = c.fetchone()[0]
    print(f"Number of generated_video assets after run 1: {count1}")

    # 3. Trigger run 2
    print("Triggering Run 2...")
    res = api_post(f'{base_url}/api/v1/workflow-versions/{version_id}/runs')
    run2_id = res['data']['workflow_run']['id']
    
    print("Waiting for run 2 to complete...")
    for _ in range(60):
        res = api_get(f'{base_url}/api/v1/workflow-runs/{run2_id}')
        status = res['data']['workflow_run']['status']
        if status in ['completed', 'failed']:
            print(f"Run 2 finished with status {status}")
            break
        time.sleep(2)

    # Check asset count again
    c.execute("SELECT count(*) FROM assets WHERE project_id = ? AND asset_type = 'generated_video'", (project_id,))
    count2 = c.fetchone()[0]
    print(f"Number of generated_video assets after run 2: {count2}")
    
    if count1 == count2 and count1 > 0:
        print("SUCCESS! Asset reuse is working perfectly.")
    else:
        print("FAILED! Asset count increased or zero assets found.")

if __name__ == '__main__':
    main()
