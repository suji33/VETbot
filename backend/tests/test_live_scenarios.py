import sys
import urllib.request
import json
import base64
import os

sys.stdout.reconfigure(encoding='utf-8')
BASE_URL = 'http://localhost:3001'

def send_chat(msg, session_id='test-slang-session', conversation_id=None):
    payload = {
        'message': msg,
        'sessionId': session_id,
        'timezone': 'Asia/Kolkata',
    }
    if conversation_id:
        payload['conversationId'] = conversation_id
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f'{BASE_URL}/api/chat',
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=45) as res:
        return json.loads(res.read().decode('utf-8'))

def send_image_chat(msg, img_path, session_id='test-img-session'):
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    data = []
    data.append(f'--{boundary}\r\nContent-Disposition: form-data; name="sessionId"\r\n\r\n{session_id}\r\n'.encode('utf-8'))
    data.append(f'--{boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\n{msg}\r\n'.encode('utf-8'))
    data.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="pet_test.png"\r\nContent-Type: image/png\r\n\r\n'.encode('utf-8'))
    with open(img_path, 'rb') as f:
        data.append(f.read())
    data.append(f'\r\n--{boundary}--\r\n'.encode('utf-8'))
    body = b''.join(data)

    req = urllib.request.Request(
        f'{BASE_URL}/api/chat/image',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req, timeout=50) as res:
        return json.loads(res.read().decode('utf-8'))

print("=== STARTING LIVE END-TO-END SCENARIO VALIDATION ===")

# Test 1: Slang/Colloquial - "my pet not give any sound"
print("\n--- TEST 1: Colloquial ('my pet not give any sound') ---")
try:
    res1 = send_chat("my pet not give any sound")
    print("Intent:", res1.get('intent'))
    print("Emergency Flag:", res1.get('isEmergency'))
    print("Answer Excerpt:\n", res1.get('answer')[:250], "...\n")
except Exception as e:
    print("FAILED:", e)

# Test 2: Unrelated - "Can you write me a python script to sort numbers?"
print("\n--- TEST 2: Unrelated ('Can you write me a python script to sort numbers?') ---")
try:
    res2 = send_chat("Can you write me a python script to sort numbers?")
    print("Intent:", res2.get('intent'))
    print("Answer Excerpt:\n", res2.get('answer')[:250], "...\n")
except Exception as e:
    print("FAILED:", e)

# Test 3: Emergency Collapse - "My dog suddenly collapsed and is not waking up"
print("\n--- TEST 3: Emergency Collapse ('My dog suddenly collapsed and is not waking up') ---")
try:
    res3 = send_chat("My dog suddenly collapsed and is not waking up")
    print("Intent:", res3.get('intent'))
    print("Emergency Flag:", res3.get('isEmergency'))
    print("Answer Excerpt:\n", res3.get('answer')[:250], "...\n")
except Exception as e:
    print("FAILED:", e)

# Test 4: Image Analysis - Dog skin allergy image + "what alergie is this"
img_sample = r'C:\Users\rkaad\.gemini\antigravity-ide\brain\d14ff404-9703-44e7-96b8-54c2f4178dd6\.user_uploaded\media_1792136520880.png'
if os.path.exists(img_sample):
    print("\n--- TEST 4: Image Analysis ('what alergie is this') ---")
    try:
        res4 = send_image_chat("what alergie is this", img_sample)
        print("Intent:", res4.get('intent'))
        print("Sources:", len(res4.get('sources', [])))
        print("Answer Excerpt:\n", res4.get('answer')[:350], "...\n")
    except Exception as e:
        print("FAILED:", e)

print("=== ALL LIVE SCENARIOS COMPLETED ===")
