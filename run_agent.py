import os
import time
import json
from dotenv import load_dotenv
from browser_use_client import BrowserUseClient

# Load environment variables
load_dotenv()

API_KEY = os.getenv("BROWSER_USE_API_KEY")

if not API_KEY:
    print("Error: BROWSER_USE_API_KEY not found in environment variables.")
    exit(1)

def main():
    client = BrowserUseClient(API_KEY)
    
    print("Creating task...")
    task_response = client.create_task("Search for the top Hacker News post and return the title and url.")
    task_id = task_response.get("id")
    session_id = task_response.get("sessionId")
    
    print(f"Task created! ID: {task_id}")
    print(f"Session ID: {session_id}")

    # Get session details to show live URL
    try:
        session_info = client.get_session(session_id)
        print(f"Watch live: {session_info.get('liveUrl')}")
    except Exception as e:
        print(f"Could not fetch session info: {e}")

    print("Waiting for task to complete...")
    
    while True:
        task_status = client.get_task(task_id)
        status = task_status.get("status")
        print(f"Status: {status}")
        
        if status in ["finished", "stopped"]:
            print("\nTask Completed!")
            print("Output:")
            print(task_status.get("output"))
            break
        
        if status == "paused":
             print("Task paused.")
             break

        time.sleep(5)

if __name__ == "__main__":
    main()
