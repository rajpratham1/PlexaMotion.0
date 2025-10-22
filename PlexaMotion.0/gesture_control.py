import cv2
import mediapipe as mp
import numpy as np
import time
import math
import actions

class GestureController:
    def __init__(self, screen_width, screen_height):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        self.screen_width = screen_width
        self.screen_height = screen_height
        self.running = False
        self.control_mode = 'hand'

        # --- Control Parameters ---
        self.smoothening = 5
        self.frame_reduction = 0.2
        self.prev_x, self.prev_y = 0, 0
        self.curr_x, self.curr_y = 0, 0
        
        self.last_action_time = 0
        self.action_cooldown = 0.4
        self.pinch_threshold = 0.04

        self.callbacks = {}

    def start(self, callbacks):
        self.callbacks = callbacks
        self.running = True
        self.callbacks.get('status', lambda x: None)("Gesture control started.")

    def stop(self):
        self.running = False
        self.callbacks.get('status', lambda x: None)("Gesture control stopped.")

    def process_frame(self, frame):
        if not self.running: return
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame_rgb = cv2.flip(frame_rgb, 1)
        frame_rgb.flags.writeable = False
        if self.control_mode == 'hand':
            self.process_hand_gestures(frame_rgb)
        elif self.control_mode == 'head':
            self.process_head_gestures(frame_rgb)
        frame_rgb.flags.writeable = True

    def process_hand_gestures(self, frame_rgb):
        """ Simplified and robust gesture processing. """
        try:
            image = frame_rgb.copy()
            image.flags.writeable = False
            timestamp = int(time.time() * 1_000_000)
            results = self.hands.process(image, timestamp_usec=timestamp)
            if not results.multi_hand_landmarks: return

            hand_landmarks = results.multi_hand_landmarks[0]
            now = time.time()

            thumb_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.THUMB_TIP]
            index_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.INDEX_FINGER_TIP]
            middle_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP]

            # --- Cursor Movement (Index Finger) ---
            x = np.interp(index_tip.x, [self.frame_reduction, 1 - self.frame_reduction], [0, self.screen_width])
            y = np.interp(index_tip.y, [self.frame_reduction, 1 - self.frame_reduction], [0, self.screen_height])
            self.curr_x = self.prev_x + (x - self.prev_x) / self.smoothening
            self.curr_y = self.prev_y + (y - self.prev_y) / self.smoothening
            actions.move_mouse(self.curr_x, self.curr_y)
            self.prev_x, self.prev_y = self.curr_x, self.curr_y

            # --- Clicks (Pinching) ---
            if (now - self.last_action_time) > self.action_cooldown:
                left_click_dist = math.hypot(thumb_tip.x - index_tip.x, thumb_tip.y - index_tip.y)
                right_click_dist = math.hypot(thumb_tip.x - middle_tip.x, thumb_tip.y - middle_tip.y)

                if left_click_dist < self.pinch_threshold:
                    actions.left_click()
                    self.callbacks.get('status', lambda x: None)("Left Click")
                    self.last_action_time = now
                elif right_click_dist < self.pinch_threshold:
                    actions.right_click()
                    self.callbacks.get('status', lambda x: None)("Right Click")
                    self.last_action_time = now
        except Exception as e:
            self.callbacks.get('status', lambda x: None)(f"Error in hand gesture processing: {e}")

    def process_head_gestures(self, frame_rgb):
        try:
            timestamp = int(time.time() * 1_000_000)
            results = self.face_mesh.process(frame_rgb, timestamp_usec=timestamp)
            if not results.multi_face_landmarks: return
            face_landmarks = results.multi_face_landmarks[0]
            nose_tip = face_landmarks.landmark[1]
            x = np.interp(nose_tip.x, [self.frame_reduction, 1 - self.frame_reduction], [0, self.screen_width])
            y = np.interp(nose_tip.y, [self.frame_reduction, 1 - self.frame_reduction], [0, self.screen_height])
            self.curr_x = self.prev_x + (x - self.prev_x) / self.smoothening
            self.curr_y = self.prev_y + (y - self.prev_y) / self.smoothening
            actions.move_mouse(self.curr_x, self.curr_y)
            self.prev_x, self.prev_y = self.curr_x, self.curr_y

            if (time.time() - self.last_action_time) > self.action_cooldown:
                upper_lip = face_landmarks.landmark[13]
                lower_lip = face_landmarks.landmark[14]
                if math.hypot(upper_lip.x - lower_lip.x, upper_lip.y - lower_lip.y) > 0.06:
                    actions.left_click()
                    self.callbacks.get('status', lambda x: None)("Mouth Click")
                    self.last_action_time = time.time()
        except Exception as e:
            self.callbacks.get('status', lambda x: None)(f"Error in head gesture processing: {e}")