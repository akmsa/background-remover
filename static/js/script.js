// ===== DOM Elements =====
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const previewSection = document.getElementById('previewSection');
const originalImage = document.getElementById('originalImage');
const processedImage = document.getElementById('processedImage');
const processedWrapper = document.getElementById('processedWrapper');
const loadingSpinner = document.getElementById('loadingSpinner');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// ===== Configuration =====
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const COMPRESSION_THRESHOLD = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// ===== State =====
let processedBlob = null;

// ===== Event Listeners =====
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
resetBtn.addEventListener('click', resetApp);
downloadBtn.addEventListener('click', downloadImage);

// ===== Drag & Drop Handlers =====
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

// ===== File Processing =====
async function processFile(file) {
    // Hide error message
    hideError();
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
        showError('Invalid file format. Please use JPG, PNG, or WebP.');
        return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        showError('File is too large. Maximum size is 5MB.');
        return;
    }
    
    // Compress image if needed
    let processedFile = file;
    if (file.size > COMPRESSION_THRESHOLD) {
        try {
            processedFile = await compressImage(file);
        } catch (error) {
            console.error('Compression error:', error);
            // Continue with original file if compression fails
        }
    }
    
    // Show preview section
    uploadSection.classList.add('hidden');
    previewSection.classList.remove('hidden');
    
    // Display original image
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    // Show loading state
    loadingSpinner.classList.remove('hidden');
    processedImage.classList.add('hidden');
    downloadBtn.classList.add('hidden');
    
    // Send to backend for processing
    await removeBackground(processedFile);
}

// ===== Image Compression =====
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                // Create canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 2048px)
                let width = img.width;
                let height = img.height;
                const maxDimension = 2048;
                
                if (width > maxDimension || height > maxDimension) {
                    const ratio = Math.min(maxDimension / width, maxDimension / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
                
                // Set canvas size and draw image
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // Create file from blob
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            reject(new Error('Compression failed'));
                        }
                    },
                    'image/jpeg',
                    0.85 // Quality
                );
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// ===== Background Removal =====
async function removeBackground(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/remove-background', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Processing failed');
        }
        
        // Get processed image
        processedBlob = await response.blob();
        
        // Display processed image
        const imageUrl = URL.createObjectURL(processedBlob);
        processedImage.src = imageUrl;
        processedImage.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        downloadBtn.classList.remove('hidden');
        
    } catch (error) {
        console.error('Processing error:', error);
        loadingSpinner.classList.add('hidden');
        showError(error.message || 'Failed to process image. Please try again.');
    }
}

// ===== Download Handler =====
function downloadImage() {
    if (!processedBlob) return;
    
    const url = URL.createObjectURL(processedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bg_removed_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ===== Reset Handler =====
function resetApp() {
    // Reset UI
    previewSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    
    // Clear images
    originalImage.src = '';
    processedImage.src = '';
    processedBlob = null;
    
    // Reset file input
    fileInput.value = '';
    
    // Hide error
    hideError();
}

// ===== Error Handling =====
function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
    errorText.textContent = '';
}
