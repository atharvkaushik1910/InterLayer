import requests
import os
from dotenv import load_dotenv

# Use the key provided by user directly for this test script
NEW_API_KEY = "960b49de2a27437a8be367a57ae29c2a"
BASE_URL = "https://tavusapi.com/v2"

def get_replicas():
    headers = {"x-api-key": NEW_API_KEY}
    try:
        response = requests.get(f"{BASE_URL}/replicas", headers=headers)
        response.raise_for_status()
        return response.json().get("data", [])
    except Exception as e:
        print(f"Error fetching replicas: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        return []

def get_personas():
    headers = {"x-api-key": NEW_API_KEY}
    try:
        response = requests.get(f"{BASE_URL}/personas", headers=headers)
        response.raise_for_status()
        return response.json().get("data", [])
    except Exception as e:
        print(f"Error fetching personas: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        return []

def main():
    print(f"Checking configuration for API Key: {NEW_API_KEY[:4]}...{NEW_API_KEY[-4:]}")
    
    print("\n--- REPLICAS ---")
    replicas = get_replicas()
    if replicas:
        for r in replicas:
            print(f"ID: {r.get('replica_id')} | Name: {r.get('replica_name')}")
    else:
        print("No replicas found. You may need to create one or use a stock replica.")

    print("\n--- PERSONAS ---")
    personas = get_personas()
    if personas:
        for p in personas:
            print(f"ID: {p.get('persona_id')} | Name: {p.get('persona_name')}")
    else:
        print("No personas found. You will need to create a persona.")

if __name__ == "__main__":
    main()
