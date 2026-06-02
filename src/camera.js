/**
 * camera.js — Camera capture module
 * Handles getUserMedia, live video feed, and frame capture as base64 JPEG.
 */

export class CameraManager {
  constructor() {
    this.video = document.getElementById('camera-video');
    this.canvas = document.getElementById('camera-canvas');
    this.placeholder = document.getElementById('camera-placeholder');
    this.capturedFrame = document.getElementById('captured-frame');
    this.capturedImage = document.getElementById('captured-image');
    this.overlay = document.getElementById('camera-overlay');

    this.stream = null;
    this.isActive = false;
    this.facingMode = 'environment'; // Back camera by default
  }

  /**
   * Start the camera stream
   */
  async start() {
    try {
      const constraints = {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      this.isActive = true;

      // Hide placeholder, show video
      this.placeholder.classList.add('hidden');
      this.video.classList.remove('hidden');

      return true;
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err.message);
      this.isActive = false;
      return false;
    }
  }

  /**
   * Stop the camera stream
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.isActive = false;
    this.video.srcObject = null;
    this.placeholder.classList.remove('hidden');
  }

  /**
   * Toggle camera on/off
   */
  async toggle() {
    if (this.isActive) {
      this.stop();
      return false;
    } else {
      return await this.start();
    }
  }

  /**
   * Flip between front and back camera
   */
  async flip() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (this.isActive) {
      this.stop();
      await this.start();
    }
  }

  /**
   * Capture a single frame as base64 JPEG
   * @returns {string|null} Base64-encoded JPEG (without data URI prefix) or null
   */
  captureFrameBase64() {
    if (!this.isActive || !this.video.videoWidth) {
      return null;
    }

    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;

    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0);

    // Get base64 without the data URI prefix
    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1];

    // Show captured frame preview
    this.showCapturedPreview(dataUrl);

    return base64;
  }

  /**
   * Capture a resized thumbnail as base64 JPEG for analytics (smaller footprint)
   * @param {number} maxWidth 
   * @param {number} maxHeight 
   * @returns {string|null} Base64 JPEG or null
   */
  captureThumbnailBase64(maxWidth = 320, maxHeight = 240) {
    if (!this.isActive || !this.video.videoWidth) {
      return null;
    }

    const tempCanvas = document.createElement('canvas');
    const ratio = Math.min(maxWidth / this.video.videoWidth, maxHeight / this.video.videoHeight, 1);
    tempCanvas.width = this.video.videoWidth * ratio;
    tempCanvas.height = this.video.videoHeight * ratio;

    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, tempCanvas.width, tempCanvas.height);

    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.6);
    return dataUrl.split(',')[1];
  }

  /**
   * Show captured frame thumbnail
   */
  showCapturedPreview(dataUrl) {
    this.capturedImage.src = dataUrl;
    this.capturedFrame.classList.add('show');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.capturedFrame.classList.remove('show');
    }, 5000);
  }

  /**
   * Start scanning animation overlay
   */
  startScanning() {
    this.overlay.classList.add('scanning');
  }

  /**
   * Stop scanning animation
   */
  stopScanning() {
    this.overlay.classList.remove('scanning');
  }

  /**
   * Check if camera API is supported
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}
