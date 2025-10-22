import pyautogui
import os
import platform
import subprocess
import webbrowser

def move_mouse(x, y):
    """Moves the mouse cursor to the specified x, y coordinates."""
    pyautogui.moveTo(x, y)

def left_click():
    """Performs a left mouse click."""
    pyautogui.click(button='left')

def right_click():
    """Performs a right mouse click."""
    pyautogui.click(button='right')

def scroll(direction, amount=120):
    """Scrolls the mouse wheel up or down."""
    if direction == 'up':
        pyautogui.scroll(amount)
    elif direction == 'down':
        pyautogui.scroll(-amount)

def play_pause():
    """Presses the play/pause media key."""
    pyautogui.press('playpause')
    return "Toggled Play/Pause"

def close_window():
    """Closes the active window using platform-specific hotkeys."""
    system = platform.system()
    if system == 'Windows':
        pyautogui.hotkey('alt', 'f4')
    elif system == 'Darwin':  # macOS
        pyautogui.hotkey('command', 'w')
    else:  # Linux
        pyautogui.hotkey('alt', 'f4')
    return "Closed active window."

def open_browser(url='google.com'):
    """Opens the default web browser to a specified URL."""
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        webbrowser.open(url)
        return f"Opening browser to {url}"
    except Exception as e:
        return f"Could not open browser: {e}"

def play_music():
    """Opens YouTube Music in the browser."""
    return open_browser("music.youtube.com")

def volume_up():
    """Increases the system volume."""
    pyautogui.press('volumeup')
    return "Volume Up"

def volume_down():
    """Decreases the system volume."""
    pyautogui.press('volumedown')
    return "Volume Down"

def sleep_pc():
    """Puts the computer to sleep."""
    system = platform.system()
    try:
        if system == 'Windows':
            os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
        elif system == 'Darwin':  # macOS
            os.system("pmset sleepnow")
        else:  # Linux
            os.system("systemctl suspend")
        return "Putting computer to sleep."
    except Exception as e:
        return f"Could not sleep PC: {e}"

def open_app(app_name):
    """Opens a specified application by name."""
    app_name = app_name.lower().strip()
    
    # Commands for Windows. For other OS, these would need to be adjusted.
    app_commands = {
        'whatsapp': 'start whatsapp',
        'microsoft store': 'start ms-windows-store:',
        'explorer': 'start explorer',
        'hill climb': 'start shell:appsfolder\A278AB0D.HillClimbRacing_h6adky7gbf63m!App',
        'edge': 'start msedge',
        'excel': 'start excel',
        'powerpoint': 'start powerpnt',
        'photos': 'start ms-photos:',
        'calculator': 'start calc',
        'clock': 'start ms-clock:'
    }

    command = app_commands.get(app_name)

    if command:
        try:
            subprocess.run(command, shell=True, check=True)
            return f"Opening {app_name.title()}"
        except Exception as e:
            return f"Could not open {app_name.title()}. Error: {e}"
    else:
        # Fallback for other simple-to-open apps
        try:
            subprocess.run(f"start {app_name}", shell=True, check=True)
            return f"Attempting to open {app_name.title()}"
        except Exception:
            return f"Sorry, I don't know how to open {app_name.title()}."