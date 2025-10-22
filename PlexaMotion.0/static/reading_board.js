document.addEventListener('DOMContentLoaded', async () => {
    const { HandLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js');

    // --- Element Cache ---
    const readingModeBtn = document.getElementById('reading-mode-btn');
    const readingBoardOverlay = document.getElementById('reading-board-overlay');
    const readingBoard = document.getElementById('reading-board');
    const exitReadingBoardBtn = document.getElementById('exit-reading-board-btn');
    const readingBoardTitle = document.querySelector('.reading-board-title');
    const canvas = document.getElementById('readingCanvas');
    const ctx = canvas.getContext('2d');
    const laserCanvas = document.getElementById('laserCanvas');
    const laserCtx = laserCanvas.getContext('2d');
    const toolbar = document.querySelector('.reading-board-toolbar');
    const colorPicker = document.getElementById('color-picker');
    const cursorSize = document.getElementById('cursor-size');
    const clearBoardBtn = document.getElementById('clear-board-btn');
    const gestureDrawBtn = document.getElementById('gesture-draw-btn');
    const uploadFileBtn = document.getElementById('upload-file-btn');
    const fileUploadInput = document.getElementById('file-upload-input');
    const pdfViewerContainer = document.getElementById('pdf-viewer-container');
    const pdfCanvas = document.getElementById('pdf-canvas');
    const pdfNav = document.getElementById('pdf-nav');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const pageCountSpan = document.getElementById('page-count');
    const saveBoardBtn = document.getElementById('save-board-btn');
    const galleryBtn = document.getElementById('gallery-btn');
    const galleryOverlay = document.getElementById('gallery-overlay');
    const galleryModalClose = document.getElementById('gallery-modal-close');
    const galleryGrid = document.getElementById('gallery-grid');
    const gestureActiveIndicator = document.getElementById('gesture-active-indicator');
    const stickyNoteBtn = document.getElementById('sticky-note-btn');
    const howToUseBtn = document.getElementById('how-to-use-btn');
    const howToUseOverlay = document.getElementById('how-to-use-overlay');
    const howToUseModalClose = document.getElementById('how-to-use-modal-close');

    // --- State Management ---
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentTool = 'pen';
    let handLandmarker;
    let gestureDrawingEnabled = false;
    let video;
    let pdfDoc = null;
    let pageNum = 1;
    let slideImages = [];

    // --- Hand Landmarker Initialization ---
    const createHandLandmarker = async () => {
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
        });
    };
    await createHandLandmarker();

    // --- PDF.js setup ---
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

    // --- General Functions ---
    function resizeCanvas() {
        canvas.width = readingBoard.offsetWidth;
        canvas.height = readingBoard.offsetHeight;
        laserCanvas.width = readingBoard.offsetWidth;
        laserCanvas.height = readingBoard.offsetHeight;
    }

    // --- Event Listeners ---
    if (readingModeBtn) {
        readingModeBtn.addEventListener('click', () => {
            readingBoardOverlay.style.display = 'flex';
            setTimeout(() => {
                readingBoard.classList.add('open');
                resizeCanvas();
            }, 10);
            setTimeout(() => { readingBoardTitle.style.display = 'none'; }, 2000);
        });
    }

    if (exitReadingBoardBtn) {
        exitReadingBoardBtn.addEventListener('click', () => {
            readingBoard.classList.remove('open');
            if (gestureDrawingEnabled) {
                toggleGestureDrawing();
            }
            setTimeout(() => {
                readingBoardOverlay.style.display = 'none';
                readingBoardTitle.style.display = 'block';
            }, 300);
        });
    }

    howToUseBtn.addEventListener('click', () => {
        howToUseOverlay.style.display = 'flex';
    });

    howToUseModalClose.addEventListener('click', () => {
        howToUseOverlay.style.display = 'none';
    });

    // --- Drawing Logic ---
    function draw(e) {
        if (currentTool === 'laser') {
            laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
            laserCtx.fillStyle = 'red';
            laserCtx.beginPath();
            laserCtx.arc(e.offsetX, e.offsetY, 5, 0, 2 * Math.PI);
            laserCtx.fill();
            return;
        }

        if (!isDrawing) return;
        
        if (currentTool === 'highlighter') {
            ctx.strokeStyle = colorPicker.value;
            ctx.lineWidth = cursorSize.value * 2;
            ctx.globalAlpha = 0.3;
        } else {
            ctx.strokeStyle = currentTool === 'pen' ? colorPicker.value : '#FFFFFF';
            ctx.lineWidth = currentTool === 'eraser' ? cursorSize.value * 5 : cursorSize.value;
            ctx.globalAlpha = 1;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
        laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
    });
    canvas.addEventListener('mouseout', () => {
        isDrawing = false;
        laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
    });

    // --- Toolbar Logic ---
    toolbar.addEventListener('click', (e) => {
        const target = e.target.closest('.toolbar-btn');
        if (target && target.dataset.tool) {
            currentTool = target.dataset.tool;
            document.querySelector('.toolbar-btn.active[data-tool]')?.classList.remove('active');
            target.classList.add('active');
            if (currentTool !== 'laser') {
                laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
            }
        }
    });

    clearBoardBtn.addEventListener('click', () => {
        if(confirm('Are you sure you want to clear the board?')) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });

    uploadFileBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', handleFileUpload);

    // --- File Handling ---
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'pdf') {
            handlePdfFile(file);
        } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
            handleImageFile(file);
        } else if (['ppt', 'pptx'].includes(extension)) {
            handlePptxFile(file);
        }
    }

    function handlePdfFile(file) {
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).promise.then(pdfDoc_ => {
                pdfDoc = pdfDoc_;
                pageNum = 1;
                renderPage(pageNum);
                pdfViewerContainer.style.display = 'flex';
                pdfNav.style.display = 'flex';
            });
        };
        fileReader.readAsArrayBuffer(file);
    }

    function handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const context = pdfCanvas.getContext('2d');
                pdfCanvas.width = img.width;
                pdfCanvas.height = img.height;
                context.drawImage(img, 0, 0);
                pdfViewerContainer.style.display = 'flex';
                pdfNav.style.display = 'none';
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }

    async function handlePptxFile(file) {
        const reader = new FileReader();
        reader.onload = async function(event) {
            const arrayBuffer = event.target.result;
            const pptxContainer = document.createElement('div');
            pptxContainer.style.display = 'none';
            document.body.appendChild(pptxContainer);

            await pptx.render(arrayBuffer, pptxContainer, null);

            const slideElements = pptxContainer.querySelectorAll('.slide');
            slideImages = [];

            for (let i = 0; i < slideElements.length; i++) {
                const canvas = await html2canvas(slideElements[i]);
                slideImages.push(canvas.toDataURL('image/png'));
            }

            document.body.removeChild(pptxContainer);

            pdfDoc = { numPages: slideImages.length, images: slideImages };
            pageNum = 1;
            renderPage(pageNum);
            pdfViewerContainer.style.display = 'flex';
            pdfNav.style.display = 'flex';
        };
        reader.readAsArrayBuffer(file);
    }

    function renderPage(num) {
        if (pdfDoc.images) { // it's a pptx
            renderPptxPage(num);
            return;
        }
        pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({ scale: 1.5 });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: pdfCanvas.getContext('2d'),
                viewport: viewport
            };
            page.render(renderContext);
        });
        pageNumSpan.textContent = num;
        pageCountSpan.textContent = pdfDoc.numPages;
    }

    function renderPptxPage(num) {
        const img = new Image();
        img.onload = function() {
            const context = pdfCanvas.getContext('2d');
            pdfCanvas.width = img.width;
            pdfCanvas.height = img.height;
            context.drawImage(img, 0, 0);
        }
        img.src = slideImages[num - 1];
        pageNumSpan.textContent = num;
        pageCountSpan.textContent = slideImages.length;
    }

    prevPageBtn.addEventListener('click', () => {
        if (pageNum <= 1) return;
        pageNum--;
        renderPage(pageNum);
    });

    nextPageBtn.addEventListener('click', () => {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        renderPage(pageNum);
    });

    // --- Gesture Drawing Logic ---
    const toggleGestureDrawing = async () => {
        gestureDrawingEnabled = !gestureDrawingEnabled;
        gestureDrawBtn.classList.toggle('active', gestureDrawingEnabled);
        gestureActiveIndicator.style.display = gestureDrawingEnabled ? 'block' : 'none';

        if (gestureDrawingEnabled) {
            if (!video) {
                video = document.createElement('video');
                video.autoplay = true;
                video.style.display = 'none';
                document.body.appendChild(video);
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            video.addEventListener('loadeddata', predictWebcam);
        } else {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.removeEventListener('loadeddata', predictWebcam);
        }
    };

    gestureDrawBtn.addEventListener('click', toggleGestureDrawing);

    let lastVideoTime = -1;
    async function predictWebcam() {
        if (!gestureDrawingEnabled) return;

        const nowInMs = Date.now();
        if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const results = await handLandmarker.detectForVideo(video, nowInMs);
            if (results.landmarks && results.landmarks.length > 0) {
                processHandLandmarks(results.landmarks[0]);
            }
        }
        window.requestAnimationFrame(predictWebcam);
    }

    function processHandLandmarks(landmarks) {
        const indexFingerTip = landmarks[8];
        const middleFingerTip = landmarks[12];
        const isFist = landmarks[5].y < landmarks[8].y && landmarks[9].y < landmarks[12].y;
        const isIndexUp = !isFist && landmarks[8].y < landmarks[5].y;
        const isTwoFingers = !isFist && landmarks[8].y < landmarks[6].y && landmarks[12].y < landmarks[10].y;
        const isPalm = !isFist && !isTwoFingers && landmarks[5].y > landmarks[8].y && landmarks[9].y > landmarks[12].y;

        const canvasX = (1 - indexFingerTip.x) * canvas.width;
        const canvasY = indexFingerTip.y * canvas.height;

        if (isFist) {
            isDrawing = false;
        } else if (isIndexUp) {
            currentTool = 'pen';
            if (!isDrawing) {
                isDrawing = true;
                [lastX, lastY] = [canvasX, canvasY];
            } else {
                draw({ offsetX: canvasX, offsetY: canvasY });
            }
        } else if (isTwoFingers) {
            currentTool = 'eraser';
            if (!isDrawing) {
                isDrawing = true;
                [lastX, lastY] = [canvasX, canvasY];
            } else {
                draw({ offsetX: canvasX, offsetY: canvasY });
            }
        } else if (isPalm) {
            if(confirm('Are you sure you want to clear the board?')) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        } else {
            isDrawing = false;
        }
    }

    // --- Save & Gallery Logic ---
    saveBoardBtn.addEventListener('click', () => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        if (pdfDoc) {
            tempCtx.drawImage(pdfCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
        }
        tempCtx.drawImage(canvas, 0, 0);

        const dataURL = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `board-${new Date().toISOString()}.png`;
        link.click();

        saveToGallery(dataURL);
    });

    function saveToGallery(dataURL) {
        let gallery = JSON.parse(localStorage.getItem('readingBoardGallery')) || [];
        gallery.unshift({ date: new Date().toLocaleString(), image: dataURL });
        if (gallery.length > 5) {
            gallery.pop();
        }
        localStorage.setItem('readingBoardGallery', JSON.stringify(gallery));
    }

    galleryBtn.addEventListener('click', () => {
        galleryOverlay.style.display = 'flex';
        loadGallery();
    });

    galleryModalClose.addEventListener('click', () => {
        galleryOverlay.style.display = 'none';
    });

    function loadGallery() {
        galleryGrid.innerHTML = '';
        const gallery = JSON.parse(localStorage.getItem('readingBoardGallery')) || [];
        if (gallery.length === 0) {
            galleryGrid.innerHTML = '<p>No saved boards yet.</p>';
            return;
        }

        gallery.forEach(item => {
            const thumb = document.createElement('div');
            thumb.className = 'gallery-thumbnail';
            thumb.innerHTML = `<img src="${item.image}" alt="Saved board"><p>${item.date}</p>`;
            galleryGrid.appendChild(thumb);
        });
    }
    
    // --- Sticky Note Logic ---
    stickyNoteBtn.addEventListener('click', createStickyNote);

    function createStickyNote() {
        const note = document.createElement('div');
        note.className = 'sticky-note';
        note.innerHTML = `
            <div class="sticky-note-header">
                <button class="sticky-note-close">&times;</button>
            </div>
            <div contenteditable="true"></div>
        `;
        readingBoard.appendChild(note);

        const closeBtn = note.querySelector('.sticky-note-close');
        closeBtn.addEventListener('click', () => {
            note.remove();
        });

        dragElement(note);
    }

    function dragElement(elmnt) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        if (elmnt.querySelector(".sticky-note-header")) {
            elmnt.querySelector(".sticky-note-header").onmousedown = dragMouseDown;
        } else {
            elmnt.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    window.addEventListener('resize', resizeCanvas);
});