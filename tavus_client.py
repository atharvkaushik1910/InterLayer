import requests
import os

class TavusClient:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("TAVUS_API_KEY")
        if not self.api_key:
            raise ValueError("TAVUS_API_KEY is not set")
        self.base_url = "https://tavusapi.com/v2" 
        self.headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }

    def create_conversation(self, replica_id, persona_id=None, callback_url=None):
        """
        Creates a new conversation with a Replica.
        """
        url = f"{self.base_url}/conversations"
        payload = {
            "replica_id": replica_id,
            "persona_id": persona_id, 
            "callback_url": callback_url 
        }

        # Remove None values
        payload = {k: v for k, v in payload.items() if v is not None}
        
        response = requests.post(url, headers=self.headers, json=payload)
        if not response.ok:
            print(f"Tavus API Error: {response.text}")
        response.raise_for_status()
        return response.json()


    def get_conversation(self, conversation_id):
        url = f"{self.base_url}/conversations/{conversation_id}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
