document.addEventListener('DOMContentLoaded', () => {
    const funModeToggle = document.getElementById('fun-mode-toggle');
    const funModeContent = document.getElementById('fun-mode-content');
    const funModeStartBtn = document.getElementById('fun-mode-start-btn');
    const funModeCanvas = document.getElementById('fun-mode-canvas');
    const ctx = funModeCanvas.getContext('2d');

    let gameRunning = false;
    let gameOver = false;
    let score = 0;
    let baselineY = null;
    const jumpThreshold = 0.05;

    // Load assets
    const playerImg = new Image();
    playerImg.src = '/assets/boy.png';
    const rockImg = new Image();
    rockImg.src = '/assets/rock.png';
    const groundImg = new Image();
    groundImg.src = '/assets/ground.png';

    let groundX = 0;

    // Player
    const player = {
        x: 50,
        y: funModeCanvas.height - 50,
        width: 30,
        height: 50,
        velocityY: 0,
        jumpPower: 12,
        gravity: 0.6,
        isJumping: false
    };

    // Obstacles
    const obstacles = [];
    const obstacleWidth = 20;
    const obstacleHeight = 40;
    const obstacleSpeed = 3;
    let frameCount = 0;

    // Face preview
    const facePreview = document.createElement('canvas');
    facePreview.width = funModeCanvas.width / 8;
    facePreview.height = funModeCanvas.height / 8;
    const facePreviewCtx = facePreview.getContext('2d');

    // Toggle Fun Mode content
    funModeToggle.addEventListener('click', () => {
        const isExpanded = funModeContent.style.display === 'block';
        funModeContent.style.display = isExpanded ? 'none' : 'block';
        funModeToggle.classList.toggle('expanded', !isExpanded);
    });

    // Start/Pause/Restart Game
    funModeStartBtn.addEventListener('click', () => {
        if (gameOver) {
            restartGame();
        } else {
            gameRunning = !gameRunning;
            if (gameRunning) {
                funModeStartBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Game';
                logToConsole('[FunMode] Game started.');
                gameLoop();
            } else {
                funModeStartBtn.innerHTML = '<i class="fas fa-play"></i> Start Game';
                logToConsole('[FunMode] Game paused.');
            }
        }
    });

    // Jump with spacebar
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !player.isJumping) {
            jump();
        }
    });

    // Listen for face landmark data
    document.addEventListener('faceLandmark', (e) => {
        if (!gameRunning) return;

        const y = e.detail.y;
        if (baselineY === null) {
            baselineY = y;
        }

        if (y < baselineY - jumpThreshold) {
            jump();
        }

        // Update face preview
        const video = document.getElementById('gestureFeed');
        facePreviewCtx.clearRect(0, 0, facePreview.width, facePreview.height);
        facePreviewCtx.drawImage(video, 0, 0, facePreview.width, facePreview.height);
    });

    function jump() {
        if (!player.isJumping) {
            player.isJumping = true;
            player.velocityY = -player.jumpPower;
            logToConsole('[FunMode] Face jump detected.');
        }
    }

    function restartGame() {
        gameOver = false;
        gameRunning = true;
        score = 0;
        obstacles.length = 0;
        player.y = funModeCanvas.height - 50;
        baselineY = null;
        funModeStartBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Game';
        funModeCanvas.classList.remove('collision-flash');
        hideGameOverModal();
        logToConsole('[FunMode] Game restarted.');
        gameLoop();
    }

    // Game Loop
    function gameLoop() {
        if (!gameRunning) return;

        // Clear canvas
        ctx.clearRect(0, 0, funModeCanvas.width, funModeCanvas.height);

        // Scrolling background
        groundX -= obstacleSpeed;
        if (groundX <= -funModeCanvas.width) {
            groundX = 0;
        }
        ctx.drawImage(groundImg, groundX, funModeCanvas.height - 10, funModeCanvas.width, 10);
        ctx.drawImage(groundImg, groundX + funModeCanvas.width, funModeCanvas.height - 10, funModeCanvas.width, 10);

        // Player
        player.velocityY += player.gravity;
        player.y += player.velocityY;

        if (player.y > funModeCanvas.height - player.height) {
            player.y = funModeCanvas.height - player.height;
            player.velocityY = 0;
            player.isJumping = false;
        }

        ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);

        // Obstacles
        frameCount++;
        if (frameCount % 100 === 0) {
            obstacles.push({
                x: funModeCanvas.width,
                y: funModeCanvas.height - obstacleHeight,
                width: obstacleWidth,
                height: obstacleHeight
            });
        }

        for (let i = 0; i < obstacles.length; i++) {
            const obstacle = obstacles[i];
            obstacle.x -= obstacleSpeed;

            ctx.drawImage(rockImg, obstacle.x, obstacle.y, obstacle.width, obstacle.height);

            // Collision detection
            if (
                player.x < obstacle.x + obstacle.width &&
                player.x + player.width > obstacle.x &&
                player.y < obstacle.y + obstacle.height &&
                player.y + player.height > obstacle.y
            ) {
                gameOver = true;
                gameRunning = false;
                logToConsole('[FunMode] Collision! Game over.');
                funModeStartBtn.style.display = 'none';
                funModeCanvas.classList.add('collision-flash');
                showGameOverModal();
            }

            // Remove off-screen obstacles
            if (obstacle.x + obstacle.width < 0) {
                obstacles.splice(i, 1);
                i--;
            }
        }

        // Score
        score++;
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Score: ' + score, 10, 20);

        // Face preview
        ctx.drawImage(facePreview, funModeCanvas.width - facePreview.width - 10, 10);

        if (!gameOver) {
            requestAnimationFrame(gameLoop);
        }
    }

    function showGameOverModal() {
        const modal = document.createElement('div');
        modal.className = 'game-over-modal';
        modal.innerHTML = `
            <div class="game-over-content">
                <h3>💀 You hit a rock!</h3>
                <p>Your score: ${score}</p>
                <button id="play-again-btn" class="action-btn"><i class="fas fa-redo"></i> Play Again</button>
            </div>
        `;
        funModeContent.appendChild(modal);

        document.getElementById('play-again-btn').addEventListener('click', () => {
            funModeStartBtn.style.display = 'block';
            restartGame();
        });
    }

    function hideGameOverModal() {
        const modal = document.querySelector('.game-over-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Log to console function
    function logToConsole(message) {
        const consoleOutput = document.getElementById('console-output');
        const time = new Date().toLocaleTimeString();
        consoleOutput.innerHTML += `<div>[${time}] ${message}</div>`;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
});