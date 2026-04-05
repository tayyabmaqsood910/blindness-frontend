document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return; // Only run on tool page
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // UI Elements
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');
    const modeButtons = document.querySelectorAll('.mode-btn');
    const intensitySlider = document.getElementById('intensitySlider');
    const intensityValue = document.getElementById('intensityValue');
    const toggleCompareBtn = document.getElementById('toggleCompareBtn');
    const resetBtn = document.getElementById('resetBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const compareBadge = document.getElementById('compareBadge');

    // State Variables
    let originalImage = null; // HTMLImageElement
    let originalImageData = null; // ImageData caching
    let processedImageData = null; // ImageData varying by intensity and mode
    let currentMode = 'normal';
    let currentIntensity = 100;
    let isShowingOriginal = false;

    // Color Transformation Matrices
    const transformations = {
        normal: [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ],
        protanopia: [
            0.56667, 0.43333, 0.0,
            0.55833, 0.44167, 0.0,
            0.0, 0.24167, 0.75833
        ],
        deuteranopia: [
            0.625, 0.375, 0.0,
            0.7, 0.3, 0.0,
            0.0, 0.3, 0.7
        ],
        tritanopia: [
            0.95, 0.05, 0.0,
            0.0, 0.43333, 0.56667,
            0.0, 0.475, 0.525
        ]
    };

    // Load Default Sample Image
    const defaultImg = new Image();
    defaultImg.onload = () => {
        loadOriginalImage(defaultImg);
    };
    defaultImg.src = 'assets/images/sample.png';

    // File Upload Handlers
    uploadArea.addEventListener('click', () => imageInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => loadOriginalImage(img);
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function loadOriginalImage(img) {
        originalImage = img;
        
        // Match canvas logical size to image dimensions
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Draw image onto canvas to grab exact pixel data
        ctx.drawImage(img, 0, 0);
        
        // Cache original image data
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Process
        applySimulation();
    }

    // Process logic
    function applySimulation() {
        if (!originalImageData) return;
        
        loadingOverlay.classList.add('active');
        
        // setTimeout to ensure overlay renders before blocking main thread
        setTimeout(() => {
            const matrix = transformations[currentMode];
            const multiplier = currentIntensity / 100;
            
            // Re-create from original
            processedImageData = ctx.createImageData(canvas.width, canvas.height);
            const size = originalImageData.data.length;
            
            const origD = originalImageData.data;
            const targetD = processedImageData.data;

            for (let i = 0; i < size; i += 4) {
                const r = origD[i];
                const g = origD[i + 1];
                const b = origD[i + 2];
                const a = origD[i + 3];

                // Calculate transformed colors
                const tR = matrix[0] * r + matrix[1] * g + matrix[2] * b;
                const tG = matrix[3] * r + matrix[4] * g + matrix[5] * b;
                const tB = matrix[6] * r + matrix[7] * g + matrix[8] * b;

                // Blend with original depending on intensity
                targetD[i]   = r + (tR - r) * multiplier;
                targetD[i+1] = g + (tG - g) * multiplier;
                targetD[i+2] = b + (tB - b) * multiplier;
                targetD[i+3] = a; // keep alpha
            }

            renderCanvas();
            loadingOverlay.classList.remove('active');
        }, 50);
    }

    function renderCanvas() {
        if (!originalImageData || !processedImageData) return;
        if (isShowingOriginal) {
            ctx.putImageData(originalImageData, 0, 0);
            compareBadge.style.display = 'block';
        } else {
            ctx.putImageData(processedImageData, 0, 0);
            compareBadge.style.display = 'none';
        }
    }

    // UI Event Listeners
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentMode = btn.dataset.mode;
            isShowingOriginal = false;
            applySimulation();
        });
    });

    intensitySlider.addEventListener('input', (e) => {
        currentIntensity = e.target.value;
        intensityValue.textContent = `${currentIntensity}%`;
    });

    intensitySlider.addEventListener('change', () => {
        // Only run heavy calculation when user stops sliding
        applySimulation();
    });

    toggleCompareBtn.addEventListener('mousedown', () => {
        isShowingOriginal = true;
        renderCanvas();
    });
    toggleCompareBtn.addEventListener('mouseup', () => {
        isShowingOriginal = false;
        renderCanvas();
    });
    toggleCompareBtn.addEventListener('mouseleave', () => {
        if(isShowingOriginal) {
            isShowingOriginal = false;
            renderCanvas();
        }
    });

    // Touch support for Before/After
    toggleCompareBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isShowingOriginal = true;
        renderCanvas();
    }, {passive: false});
    toggleCompareBtn.addEventListener('touchend', () => {
        isShowingOriginal = false;
        renderCanvas();
    });

    resetBtn.addEventListener('click', () => {
        currentMode = 'normal';
        currentIntensity = 100;
        intensitySlider.value = 100;
        intensityValue.textContent = '100%';
        isShowingOriginal = false;
        
        modeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-mode="normal"]').classList.add('active');
        
        applySimulation();
    });

    downloadBtn.addEventListener('click', () => {
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `visionx-${currentMode}-simulated.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
});
