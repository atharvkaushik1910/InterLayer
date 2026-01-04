import os

def update_env(file_path, updates):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r') as f:
        lines = f.readlines()

    new_lines = []
    processed_keys = set()

    for line in lines:
        key = line.split('=')[0].strip()
        if key in updates:
            new_lines.append(f"{key}={updates[key]}\n")
            processed_keys.add(key)
        else:
            new_lines.append(line)

    # Add missing keys
    for key, value in updates.items():
        if key not in processed_keys:
            new_lines.append(f"{key}={value}\n")

    with open(file_path, 'w') as f:
        f.writelines(new_lines)
    
    print(f"Updated {file_path} with: {updates}")

if __name__ == "__main__":
    updates = {
        "TAVUS_API_KEY": "960b49de2a27437a8be367a57ae29c2a",
        "TAVUS_REPLICA_ID": "rf6b1c8d5e9d",
        "TAVUS_PERSONA_ID": "pb8bb46b"
    }
    update_env(".env", updates)
