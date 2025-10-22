from flask import Flask, render_template, jsonify, send_from_directory, request
from flask_socketio import SocketIO, emit
import pyautogui
import threading
import base64
import os
import numpy as np
import cv2
from werkzeug.utils import secure_filename

from gesture_control import GestureController
from voice_control import VoiceController
import actions

# --- App Configuration ---
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'mp4'}

app = Flask(__name__, static_folder='static', static_url_path='', template_folder='static')
app.config['SECRET_key'] = 'secret-key-for-plexamotion'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins="*")

# --- Globals ---
screen_width, screen_height = pyautogui.size()
gesture_controller = GestureController(screen_width, screen_height)
voice_controller = VoiceController()

# --- State Management ---
class SystemState:
    def __init__(self):
        self.gesture_active = False
        self.voice_active = False
        self.mode = 'hybrid'
        self.teaching_mode_active = False
        self.tts_enabled = True

state = SystemState()

# --- Helper Functions ---
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def log_to_console(message, source="System"):
    socketio.emit('console_log', {'log': message, 'source': source})

# --- Flask Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/gesture/mode', methods=['POST'])
def set_gesture_mode():
    data = request.get_json()
    mode = data.get('mode')
    if mode in ['hand', 'head']:
        gesture_controller.control_mode = mode
        log_to_console(f"{mode.capitalize()} tracking mode activated", source="Gesture")
        emit_full_status()
        return jsonify({"success": True, "message": f"Mode changed to {mode}"})
    return jsonify({"success": False, "message": "Invalid mode"}), 400

@app.route('/action/<command>', methods=['POST'])
def handle_action_route(command):
    log_to_console(f"Executing action: {command}", source="Action")
    action_map = {
        'browser': actions.open_browser,
        'music': actions.play_music,
        'vol_up': actions.volume_up,
        'vol_down': actions.volume_down,
        'close': actions.close_window,
        'sleep': actions.sleep_pc
    }
    func = action_map.get(command)
    if func:
        result = func()
        log_to_console(result, source="Action")
        return jsonify({"success": True, "result": result})
    return jsonify({"success": False, "message": "Unknown action"}), 404

# --- SocketIO Handlers ---
@socketio.on('connect')
def handle_connect(auth=None):
    print('Client connected')
    emit_full_status()

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('request_status')
def handle_request_status():
    emit_full_status()

@socketio.on('toggle_gesture')
def handle_toggle_gesture(data):
    is_active = data.get('active', False)
    if is_active != state.gesture_active:
        state.gesture_active = is_active
        if state.gesture_active:
            gesture_controller.start({
                'status': lambda msg: log_to_console(msg, "Gesture"),
                'zoom': lambda direction: socketio.emit('zoom', {'direction': direction})
            })
        else:
            gesture_controller.stop()
    emit_full_status()

@socketio.on('process_frame')
def process_frame(data):
    if not state.gesture_active: return
    try:
        b64_string = data['frame'].split(',')[1]
        img_bytes = base64.b64decode(b64_string)
        frame = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        gesture_controller.process_frame(frame)
    except Exception as e:
        print(f"Error processing frame: {e}")

@socketio.on('toggle_voice')
def handle_toggle_voice(data):
    is_active = data.get('active', False)
    if is_active != state.voice_active:
        state.voice_active = is_active
        log_to_console(f"Voice mode {{'enabled' if is_active else 'disabled'}}", "Vero")
    emit_full_status()

# --- Emitters ---
def emit_full_status():
    socketio.emit('full_status', {
        'gestureActive': gesture_controller.running,
        'voiceActive': state.voice_active,
        'activeMode': state.mode,
        'gestureMode': gesture_controller.control_mode,
        'lastCommand': "None"
    })

if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    print("Starting PlexaMotion v2.1 server on http://127.0.0.1:5000")
    print("Press CTRL+C to quit.")
    socketio.run(app, host='127.0.0.1', port=5000, allow_unsafe_werkzeug=True)
