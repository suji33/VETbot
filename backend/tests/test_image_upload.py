import sys
import urllib.request
import json
import os

sys.stdout.reconfigure(encoding='utf-8')
img_path = r'C:\Users\rkaad\.gemini\antigravity-ide\brain\d14ff404-9703-44e7-96b8-54c2f4178dd6\.user_uploaded\media_1792136520880.png'

if not os.path.exists(img_path):
    print("Error: image path does not exist:", img_path)
    sys.exit(1)

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
data = []
data.append(f'--{boundary}\r\nContent-Disposition: form-data; name="sessionId"\r\n\r\neval-session-img\r\n'.encode('utf-8'))
data.append(f'--{boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\nWhat could this skin problem be?\r\n'.encode('utf-8'))
data.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="pet_skin.png"\r\nContent-Type: image/png\r\n\r\n'.encode('utf-8'))
with open(img_path, 'rb') as f:
    data.append(f.read())
data.append(f'\r\n--{boundary}--\r\n'.encode('utf-8'))
body = b''.join(data)

req = urllib.request.Request(
    'http://localhost:3001/api/chat/image',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)

try:
    with urllib.request.urlopen(req, timeout=60) as res:
        out = json.loads(res.read().decode('utf-8'))
        print("=== IMAGE CHAT RESPONSE ===")
        print("CONVERSATION ID:", out.get("conversationId"))
        print("INTENT:", out.get("intent"))
        print("SOURCES:", len(out.get("sources", [])))
        for s in out.get("sources", []):
            print(" - Source Title:", s.get("title"))
        print("\nANSWER:\n", out.get("answer"))
except urllib.error.HTTPError as e:
    print(f"HTTPError {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
