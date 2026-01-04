from dotenv import load_dotenv
import os
from tavus_client import TavusClient
import json

def main():
    load_dotenv()
    api_key = os.getenv("TAVUS_API_KEY")
    replica_id = os.getenv("TAVUS_REPLICA_ID")
    persona_id = os.getenv("TAVUS_PERSONA_ID")
    
    if not api_key:
        print("MISSING API KEY")
        return

    client = TavusClient(api_key=api_key)

    print(f"Testing with voice_only=False, replica={replica_id}, persona={persona_id}")

    try:
        # Mimic server.py exactly
        response = client.create_conversation(
            replica_id,
            persona_id=persona_id,
            conversation_name=None,
            context=None,
            properties=None
        )
        print("Success!")
        print(json.dumps(response, indent=2))
    except Exception as e:
        print("Failed!")
        print(e)

if __name__ == "__main__":
    main()
