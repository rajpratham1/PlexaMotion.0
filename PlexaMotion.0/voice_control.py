import speech_recognition as sr
import threading
import pyttsx3
import time
import actions

class VoiceController:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        self.engine = pyttsx3.init()
        self.running = False
        self.listening_for_wake_word = True
        self.WAKE_WORD = "hey vision"
        self.callbacks = {}
        self.speak_lock = threading.Lock()

        try:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
        except Exception as e:
            print(f"Could not initialize microphone: {e}")

    def start(self, callbacks):
        self.callbacks = callbacks
        if not self.running:
            self.running = True
            self.listen_thread = threading.Thread(target=self._main_loop)
            self.listen_thread.daemon = True
            self.listen_thread.start()
            self.callbacks['status']("Wake Word engine started.")

    def stop(self):
        if self.running:
            self.running = False
            self.callbacks['status']("Voice control stopped.")

    def _speak(self, text):
        if not self.callbacks.get('tts_enabled', lambda: True)(): return
        with self.speak_lock:
            try:
                self.engine.say(text)
                self.engine.runAndWait()
            except Exception as e:
                print(f"Speech Error: {e}")

    def _main_loop(self):
        while self.running:
            if self.listening_for_wake_word:
                self._listen_for_wake_word()
            else:
                self._listen_for_commands()

    def _listen_for_wake_word(self):
        self.callbacks['status'](f'Listening for "{self.WAKE_WORD}"... ')
        try:
            with self.microphone as source:
                audio = self.recognizer.listen(source, timeout=None, phrase_time_limit=4)
            text = self.recognizer.recognize_google(audio).lower()
            if self.WAKE_WORD in text:
                self.listening_for_wake_word = False
                self._speak("Yes?")
        except (sr.UnknownValueError, sr.WaitTimeoutError):
            pass
        except sr.RequestError as e:
            self.callbacks['status'](f"API Error: {e}")
            print(f"API Error during wake word listen: {e}")
            time.sleep(5)

    def _listen_for_commands(self):
        self.callbacks['status']("Listening for command...")
        try:
            with self.microphone as source:
                audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=5)
            self.callbacks['status']("Recognizing...")
            text = self.recognizer.recognize_google(audio).lower()
            self.callbacks['speech_text'](text)

            executed = False
            if "go to sleep" in text:
                self.listening_for_wake_word = True
                self._speak("Going to sleep.")
                executed = True

            elif 'scroll' in text:
                if 'up' in text: self._speak("Scrolling up"); actions.scroll('up')
                elif 'down' in text: self._speak("Scrolling down"); actions.scroll('down')
                else: self._speak("Please be more specific.")
                executed = True

            elif 'play music' in text:
                self._speak(actions.play_music())
                executed = True

            elif text.startswith("type"):
                text_to_type = text.replace("type", "").strip()
                if text_to_type: self._speak(f"Typing: {text_to_type}"); actions.type_text(text_to_type)
                executed = True

            elif 'close window' in text:
                self._speak("Closing window")
                actions.close_window()
                executed = True

            elif 'open' in text:
                app_name = text.replace("open", "").strip()
                if app_name: self._speak(actions.open_app(app_name))
                executed = True

            if not executed:
                self.callbacks['status'](f'Command not recognized: "{text}"')

        except sr.WaitTimeoutError:
            self.callbacks['status']("No command heard. Going back to sleep.")
            self.listening_for_wake_word = True
        except sr.UnknownValueError:
            self.callbacks['status']("Could not understand audio.")
        except sr.RequestError as e:
            self.callbacks['status'](f"API Error: {e}")
            self.listening_for_wake_word = True # Go to sleep if API fails