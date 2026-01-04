from dotenv import load_dotenv
import os

load_dotenv()
persona_id = os.getenv("TAVUS_PERSONA_ID")
replica_id = os.getenv("TAVUS_REPLICA_ID")

print(f"PERSONA_ID: '{persona_id}'")
print(f"REPLICA_ID: '{replica_id}'")
