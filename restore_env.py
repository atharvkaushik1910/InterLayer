content = """BROWSER_USE_API_KEY=bu_kw0GnmrntZPm0VupPoG016Vr4WfBlnNG3_RVow9ho3Q
TAVUS_API_KEY=960b49de2a27437a8be367a57ae29c2a
TAVUS_REPLICA_ID=rf6b1c8d5e9d
TAVUS_PERSONA_ID=pb8bb46b
"""
with open(".env", "w") as f:
    f.write(content)
print("Restored .env")
