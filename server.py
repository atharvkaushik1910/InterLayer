from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os

from dotenv import load_dotenv
from browser_use_client import BrowserUseClient
from tavus_client import TavusClient

load_dotenv()

API_KEY = os.getenv("BROWSER_USE_API_KEY")
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")

TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID", "r79e1c033f")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID")

if not API_KEY:
    raise ValueError("BROWSER_USE_API_KEY is not set")

client = BrowserUseClient(API_KEY)
tavus_client = None
if TAVUS_API_KEY:
    tavus_client = TavusClient(TAVUS_API_KEY)
else:
    print("WARNING: TAVUS_API_KEY not set. Tavus features will be disabled.")


from fastapi.responses import FileResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return FileResponse("static/index.html")


class TaskRequest(BaseModel):
    task: str


class IntentRequest(BaseModel):
    query: str


class TavusSessionRequest(BaseModel):
    replica_id: str | None = None
    persona_id: str | None = None
    conversation_name: str | None = None
    context: str | None = None
    properties: dict | None = None


# Global variable to store active session
active_session_id = None
active_live_url = None


@app.post("/api/tavus/session")
async def create_tavus_session(request: TavusSessionRequest):
    if not tavus_client:
        raise HTTPException(status_code=500, detail="Tavus API Key not configured")

    replica_id = request.replica_id or TAVUS_REPLICA_ID
    persona_id = request.persona_id or TAVUS_PERSONA_ID

    print(
        f"DEBUG: creating session for replica_id={replica_id}, persona_id={persona_id}"
    )

    if not replica_id:
        raise HTTPException(status_code=400, detail="Replica ID required")

    try:
        conversation = tavus_client.create_conversation(
            replica_id,
            persona_id=persona_id,
            conversation_name=request.conversation_name,
            context=request.context,
            properties=request.properties,
        )
        return conversation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process_intent")
async def process_intent(request: IntentRequest):
    """
    Simple intent router:
    - If query implies action -> Run Browser Use
    - Else -> Return basic response (Pre-sales logic mock)
    """
    query = request.query.lower()

    # 1. Check for Action Keywords
    # 1. Check for Action Keywords
    action_keywords = [
        "buy",
        "search",
        "browse",
        "go to",
        "click",
        "add to cart",
        "purchase",
        "show me",
        "open",
        "navigate",
    ]

    # Check if any keyword matches
    is_action = False
    for kw in action_keywords:
        if kw in query:
            is_action = True
            break

    if is_action:
        # Trigger Browser Use
        return {
            "type": "action",
            "message": "I will get right on that.",
            "task": request.query,
        }
    else:
        # 2. Pre-sales / Conversation Logic (Mock or LLM)
        # For now, simple heuristics for the demo scenarios
        response_text = "I can help with that."

        if "birthday" in query and "winter" in query:
            response_text = "For a winter birthday party, I recommend warm yet stylish options. Velvet dresses, smart blazers with turtlenecks, or layered outfits are great. Would you like me to search for some options on Amazon?"
        elif "sap" in query:
            response_text = "I can guide you through SAP. Are you looking to create a purchase requisition or check inventory levels? I can show you how to do it."

        return {"type": "conversation", "message": response_text}


@app.post("/api/run")
async def run_task(request: TaskRequest):
    global active_session_id, active_live_url

    try:
        session_id = active_session_id
        live_url = active_live_url

        # Check if we need a new session
        create_new = True
        if session_id:
            try:
                # Check if session is still valid/active
                session_info = client.get_session(session_id)
                if session_info.get("status") == "active":
                    create_new = False
                    print(f"DEBUG: Reusing active session: {session_id}")
                else:
                    print(
                        f"DEBUG: Previous session {session_id} is {session_info.get('status')}. Creating new one."
                    )
            except Exception:
                print("DEBUG: Error checking session status. Creating new one.")

        if create_new:
            # Create a session first to ensure it persists
            session_response = client.create_session()
            session_id = session_response.get("id")
            live_url = session_response.get("liveUrl")

            # Update global state
            active_session_id = session_id
            active_live_url = live_url
            print(f"DEBUG: Created New Session: {session_id}, LiveURL: {live_url}")

        # Create task in that session
        response = client.create_task(request.task, session_id=session_id)

        return {
            "taskId": response.get("id"),
            "sessionId": session_id,
            "liveUrl": live_url,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/task/{task_id}")
async def get_task_status(task_id: str):
    try:
        response = client.get_task(task_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/session/{session_id}")
async def get_session_info(session_id: str):
    try:
        response = client.get_session(session_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
