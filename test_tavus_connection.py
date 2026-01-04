import os
import sys
from dotenv import load_dotenv
from tavus_client import TavusClient

def main():
    # Load environment variables
    load_dotenv()
    
    api_key = os.getenv("TAVUS_API_KEY")
    replica_id = os.getenv("TAVUS_REPLICA_ID")
    persona_id = os.getenv("TAVUS_PERSONA_ID")

    if not api_key:
        print("Error: TAVUS_API_KEY not found in environment variables.")
        return

    if not replica_id:
        print("Error: TAVUS_REPLICA_ID not found in environment variables.")
        return

    print("Initializing Tavus Client...")
    client = TavusClient(api_key=api_key)

    print(f"Creating test conversation with Replica ID: {replica_id}...")
    
    try:
        # Create a test conversation
        # Using a distinct name for easy identification in dashboard
        conversation_name = "Automated Verification Test"
        
        # Test properties (optional)
        properties = {
            "max_call_duration": 60, # 60 seconds
            "enable_recording": True
        }

        response = client.create_conversation(
            replica_id=replica_id,
            persona_id=persona_id,
            conversation_name=conversation_name,
            properties=properties
        )
        
        print("\nSUCCESS! Conversation created.")
        print("-" * 30)
        print(f"Conversation ID: {response.get('conversation_id')}")
        print(f"Conversation Name: {response.get('conversation_name')}")
        print(f"Conversation URL: {response.get('conversation_url')}")
        print(f"Status: {response.get('status')}")
        print("-" * 30)
        
    except Exception as e:
        print(f"\nFAILURE: Could not create conversation.")
        print(f"Error details: {e}")

if __name__ == "__main__":
    main()
