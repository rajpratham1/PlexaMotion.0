# PlexaMotion.0

PlexaMotion.0 is a Python-based application that allows you to control your computer using hand gestures and voice commands. It provides a web-based interface to configure and manage the control modes.

## Features

- **Gesture Control:** Control your mouse cursor using hand or head movements.
- **Voice Control:** Execute commands using your voice.
- **Web-based UI:** Easy-to-use interface for monitoring and controlling the application.
- **Extensible:** Easily add new voice and gesture commands.

## Installation

Follow these steps to set up and run PlexaMotion.0 on your local machine.

### 1. Prerequisites

- **Python:** Make sure you have Python 3.7+ installed. You can download it from [python.org](https://www.python.org/downloads/).
- **Git:** (Optional) For cloning the repository. You can install it from [git-scm.com](https://git-scm.com/downloads).

### 2. Clone the Repository

Open your terminal or command prompt and run the following command to clone the repository:

```bash
git clone <your-repository-url>
cd PlexaMotion.0
```

If you don't have Git, you can download the project as a ZIP file and extract it.

### 3. Create a Virtual Environment

It is recommended to use a virtual environment to manage project dependencies.

```bash
# Create the virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 4. Install Dependencies

Install all the required Python packages using pip:

```bash
pip install -r PlexaMotion.0/requirements.txt
```

## How to Run the Application

1.  Make sure your virtual environment is activated.
2.  Run the `main.py` script:

    ```bash
    python PlexaMotion.0/main.py
    ```

3.  Open your web browser and navigate to:

    ```
    http://127.0.0.1:5000
    ```

## How to Use

### Gesture Control

1.  Click on the "Gesture" toggle button in the web interface to enable gesture control.
2.  Select either "Hand" or "Head" mode.
3.  The application will use your webcam to track your movements and control the mouse.

### Voice Control (Viro)

1.  Click on the "Viro" toggle button to enable voice control.
2.  You can use the following voice commands:
    - "Open browser"
    - "Play music"
    - "Volume up"
    - "Volume down"
    - "Close window"
    - "Go to sleep"
    - "Open WhatsApp"
    - "Open Microsoft Store"
    - "Open Explorer"
    - "Open Hill Climb"
    - "Open Edge"
    - "Open Excel"
    - "Open PowerPoint"
    - "Open Photos"
    - "Open Calculator"
    - "Open Clock"

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
# PlexaMotion.0  
