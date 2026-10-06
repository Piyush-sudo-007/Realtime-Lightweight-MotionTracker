#!/usr/bin/env python3
"""
Motion to Keys - PC Keyboard Controller Bridge
Connects to Motion Tracker server over WebSocket and maps smartphone camera gestures
into PC keypresses (Arrow keys, Space, WASD) for external games.
"""

import sys
import time
import socketio

try:
    import pyautogui
    pyautogui.FAILSAFE = False
except ImportError:
    print("[WARN] 'pyautogui' module not found. Install via: pip install pyautogui python-socketio")
    sys.exit(1)

# Initialize SocketIO Client
sio = socketio.Client()

SERVER_URL = "http://localhost:3000"

# Active Key State tracking to prevent redundant keypress events
current_keys = {
    'left': False,
    'right': False,
    'up': False,
    'down': False,
    'space': False
}

@sio.event
def connect():
    print(f"\n[CONNECTED] Successfully connected to Motion Tracker at {SERVER_URL}")
    print("=================================================================")
    print(" 🎮 PC Key Mapper active!")
    print("  • Lean Left   --> Hold Left Arrow ('left')")
    print("  • Lean Right  --> Hold Right Arrow ('right')")
    print("  • Jump        --> Press Spacebar ('space')")
    print("  • Duck/Squat  --> Press Down Arrow ('down')")
    print("  • Punch Left  --> Press 'z'")
    print("  • Punch Right --> Press 'x'")
    print("=================================================================\n")

@sio.event
def disconnect():
    print("[DISCONNECTED] Disconnected from Motion Tracker server.")

@sio.on('motion_event')
def on_motion_event(data):
    gestures = data.get('gestures', {})
    
    # 1. Lean Left / Right
    lean_left = gestures.get('leanLeft', False)
    lean_right = gestures.get('leanRight', False)

    if lean_left and not current_keys['left']:
        pyautogui.keyDown('left')
        current_keys['left'] = True
        print("[KEY] Pressing LEFT")
    elif not lean_left and current_keys['left']:
        pyautogui.keyUp('left')
        current_keys['left'] = False

    if lean_right and not current_keys['right']:
        pyautogui.keyDown('right')
        current_keys['right'] = True
        print("[KEY] Pressing RIGHT")
    elif not lean_right and current_keys['right']:
        pyautogui.keyUp('right')
        current_keys['right'] = False

    # 2. Jump (Spacebar)
    jump = gestures.get('jump', False)
    if jump and not current_keys['space']:
        pyautogui.press('space')
        current_keys['space'] = True
        print("[KEY] Triggered JUMP (Space)")
    elif not jump:
        current_keys['space'] = False

    # 3. Duck / Squat (Down Arrow)
    squat = gestures.get('squat', False)
    if squat and not current_keys['down']:
        pyautogui.keyDown('down')
        current_keys['down'] = True
        print("[KEY] Pressing DUCK (Down)")
    elif not squat and current_keys['down']:
        pyautogui.keyUp('down')
        current_keys['down'] = False

    # 4. Punches (Z and X keys)
    if gestures.get('punchLeft', False):
        pyautogui.press('z')
        print("[KEY] Triggered LEFT PUNCH ('z')")

    if gestures.get('punchRight', False):
        pyautogui.press('x')
        print("[KEY] Triggered RIGHT PUNCH ('x')")

def main():
    print(f"Connecting to Motion Tracker server at {SERVER_URL}...")
    try:
        sio.connect(SERVER_URL)
        sio.wait()
    except KeyboardInterrupt:
        print("\nExiting PC Key Mapper.")
        sio.disconnect()
    except Exception as e:
        print(f"[ERROR] Could not connect to server at {SERVER_URL}: {e}")
        print("Please make sure 'node server.js' is running first!")

if __name__ == '__main__':
    main()
