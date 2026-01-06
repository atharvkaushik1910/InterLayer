import requests
import json
import time


class BrowserUseClient:
    def __init__(self, api_key, base_url="https://api.browser-use.com/api/v2"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "X-Browser-Use-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    def create_session(self):
        url = f"{self.base_url}/sessions"
        # Optional: Add proxies or timeout here if needed
        # For now, just create a default session
        response = requests.post(url, headers=self.headers, json={})
        response.raise_for_status()
        return response.json()

    def create_task(self, task_description, session_id=None):
        url = f"{self.base_url}/tasks"
        payload = {"task": task_description}
        if session_id:
            payload["sessionId"] = session_id

        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()

    def get_task(self, task_id):
        url = f"{self.base_url}/tasks/{task_id}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def list_sessions(self):
        url = f"{self.base_url}/sessions"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def get_session(self, session_id):
        url = f"{self.base_url}/sessions/{session_id}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def stop_task(self, task_id):
        url = f"{self.base_url}/tasks/{task_id}"
        payload = {"action": "stop"}
        response = requests.patch(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()
