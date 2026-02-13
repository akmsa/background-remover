from flask import Flask, render_template, request, send_file, jsonify
from flask_cors import CORS
from rembg import remove
from PIL import Image
import io
import os

app = Flask(__name__)
CORS(app)

# Configuration for lightweight performance
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_IMAGE_DIMENSION = 2048
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

# Global variable for lazy model loading
model_loaded = False

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def optimize_image_size(image):
    """Resize image if it exceeds maximum dimensions to reduce processing time"""
    width, height = image.size
    
    if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        # Calculate new dimensions maintaining aspect ratio
        ratio = min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height)
        new_width = int(width * ratio)
        new_height = int(height * ratio)
        
        # Use LANCZOS for high-quality downsampling
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    return image

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index.html')

@app.route('/remove-background', methods=['POST'])
def remove_background():
    """Process image and remove background"""
    global model_loaded
    
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file extension
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file format. Allowed: JPG, PNG, WebP'}), 400
        
        # Read file
        file_bytes = file.read()
        
        # Check file size
        if len(file_bytes) > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large. Maximum size: 5MB'}), 400
        
        # Load image
        input_image = Image.open(io.BytesIO(file_bytes))
        
        # Convert to RGB if necessary (for PNG with transparency)
        if input_image.mode in ('RGBA', 'LA', 'P'):
            # Keep RGBA for transparency support
            pass
        elif input_image.mode != 'RGB':
            input_image = input_image.convert('RGB')
        
        # Optimize image size for faster processing on lower-end devices
        input_image = optimize_image_size(input_image)
        
        # Convert image to bytes for rembg
        img_byte_arr = io.BytesIO()
        input_image.save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()
        
        # Remove background (model loads lazily on first request)
        if not model_loaded:
            print("Loading background removal model (first-time initialization)...")
            model_loaded = True
        
        output_bytes = remove(img_byte_arr)
        
        # Return the processed image
        return send_file(
            io.BytesIO(output_bytes),
            mimetype='image/png',
            as_attachment=True,
            download_name='removed_bg.png'
        )
    
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return jsonify({'error': f'Error processing image: {str(e)}'}), 500

if __name__ == '__main__':
    # Run locally or in production
    # Debug should be False in production for security
    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)
