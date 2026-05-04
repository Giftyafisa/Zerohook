const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

class R2StorageManager {
  constructor() {
    this.normalizeEnvValue = (value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return '';

      const normalized = trimmed.toLowerCase();
      if (
        normalized === 'your_account_id'
        || normalized === 'your_access_key_id'
        || normalized === 'your_secret_access_key'
        || normalized === 'your_bucket_name'
        || normalized === 'your_public_base_url'
        || normalized === 'your_worker_base_url'
        || normalized === 'your_cdn_base_url'
        || normalized.startsWith('your_')
      ) {
        return '';
      }

      return trimmed;
    };

    this.accountId = this.normalizeEnvValue(process.env.R2_ACCOUNT_ID);
    this.accessKeyId = this.normalizeEnvValue(process.env.R2_ACCESS_KEY_ID);
    this.secretAccessKey = this.normalizeEnvValue(process.env.R2_SECRET_ACCESS_KEY);
    this.bucket = this.normalizeEnvValue(process.env.R2_BUCKET_NAME || process.env.R2_BUCKET);
    this.publicBaseUrl = this.normalizeBaseUrl(this.normalizeEnvValue(process.env.R2_PUBLIC_BASE_URL));
    this.imageWorkerBaseUrl = this.normalizeBaseUrl(this.normalizeEnvValue(process.env.CF_IMAGE_WORKER_BASE_URL));
    this.imageCdnBaseUrl = this.normalizeBaseUrl(this.normalizeEnvValue(process.env.CF_IMAGE_CDN_BASE_URL));
    this.defaultImageQuality = parseInt(process.env.CF_IMAGE_QUALITY, 10) || 85;
    this.defaultImageFit = this.normalizeEnvValue(process.env.CF_IMAGE_FIT) || 'cover';

    this.isConfigured = Boolean(
      this.accountId
      && this.accessKeyId
      && this.secretAccessKey
      && this.bucket
      && this.publicBaseUrl
    );

    this.client = null;

    if (!this.isConfigured) {
      const missing = [];
      if (!this.accountId) missing.push('R2_ACCOUNT_ID');
      if (!this.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
      if (!this.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
      if (!this.bucket) missing.push('R2_BUCKET_NAME');
      if (!this.publicBaseUrl) missing.push('R2_PUBLIC_BASE_URL');

      console.log(`⚠️  Cloudflare R2 not fully configured (${missing.join(', ')} missing).`);
      return;
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      }
    });

    console.log('✅ Cloudflare R2 configured successfully');
    console.log(`📦 R2 bucket: ${this.bucket}`);
    if (this.imageWorkerBaseUrl) {
      console.log('🖼️  Cloudflare image optimization: worker mode');
    } else if (this.imageCdnBaseUrl) {
      console.log('🖼️  Cloudflare image optimization: cdn-cgi mode');
    } else {
      console.log('🖼️  Cloudflare image optimization: direct object URL mode');
    }
  }

  normalizeBaseUrl(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    return value.replace(/\/+$/, '');
  }

  getExtension(mimeType, originalName = '') {
    const mimeMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp'
    };

    if (mimeMap[mimeType]) return mimeMap[mimeType];

    const ext = path.extname(String(originalName || '')).toLowerCase();
    if (ext && ext.length <= 8) return ext;

    return '.jpg';
  }

  sanitizePathSegment(value) {
    return String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
  }

  buildObjectUrl(key) {
    const encoded = String(key)
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${this.publicBaseUrl}/${encoded}`;
  }

  getImageOptimizationMode() {
    if (this.imageWorkerBaseUrl) return 'worker';
    if (this.imageCdnBaseUrl) return 'cdn-cgi';
    return 'none';
  }

  getOptimizedImageUrl(sourceUrl, options = {}) {
    const width = Number(options.width || 800);
    const height = Number(options.height || 800);
    const quality = Number(options.quality || this.defaultImageQuality);
    const fit = String(options.fit || this.defaultImageFit);
    const format = String(options.format || 'auto');

    if (this.imageWorkerBaseUrl) {
      const workerUrl = new URL(this.imageWorkerBaseUrl);
      workerUrl.searchParams.set('url', sourceUrl);
      workerUrl.searchParams.set('width', String(width));
      workerUrl.searchParams.set('height', String(height));
      workerUrl.searchParams.set('fit', fit);
      workerUrl.searchParams.set('quality', String(quality));
      workerUrl.searchParams.set('format', format);
      return workerUrl.toString();
    }

    if (this.imageCdnBaseUrl) {
      const transform = [
        `width=${width}`,
        `height=${height}`,
        `fit=${fit}`,
        `quality=${quality}`,
        `format=${format}`
      ].join(',');
      return `${this.imageCdnBaseUrl}/cdn-cgi/image/${transform}/${sourceUrl}`;
    }

    return sourceUrl;
  }

  async uploadBuffer(buffer, options = {}) {
    if (!this.isConfigured || !this.client) {
      return { success: false, error: 'R2 not configured' };
    }

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return { success: false, error: 'Empty upload buffer' };
    }

    const objectKey = String(options.key || '').trim();
    if (!objectKey) {
      return { success: false, error: 'Object key is required' };
    }

    const contentType = String(options.mimeType || 'application/octet-stream');

    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
        CacheControl: options.cacheControl || 'public, max-age=31536000, immutable',
        Metadata: options.metadata || undefined
      }));

      const originalUrl = this.buildObjectUrl(objectKey);
      const optimizedUrl = this.getOptimizedImageUrl(originalUrl, options.transformations || {});

      return {
        success: true,
        key: objectKey,
        originalUrl,
        url: optimizedUrl,
        optimizationType: this.getImageOptimizationMode()
      };
    } catch (error) {
      console.error('R2 upload error:', {
        message: error?.message || 'Unknown R2 upload error',
        name: error?.name || 'R2UploadError',
        code: error?.code || null
      });

      return {
        success: false,
        error: error?.message || 'R2 upload failed',
        name: error?.name || 'R2UploadError',
        code: error?.code || null
      };
    }
  }

  async uploadProfileImage(buffer, options = {}) {
    const safeUserId = this.sanitizePathSegment(options.userId || 'unknown');
    const extension = this.getExtension(options.mimeType, options.originalName);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const objectKey = `profiles/${safeUserId}/profile-${Date.now()}-${randomSuffix}${extension}`;

    return this.uploadBuffer(buffer, {
      key: objectKey,
      mimeType: options.mimeType,
      metadata: {
        user_id: safeUserId,
        upload_type: 'profile_picture'
      },
      transformations: {
        width: options.width || 800,
        height: options.height || 800,
        fit: options.fit || 'cover',
        quality: options.quality || this.defaultImageQuality,
        format: options.format || 'auto'
      }
    });
  }

  async deleteObject(objectKey) {
    if (!this.isConfigured || !this.client) {
      return { success: false, error: 'R2 not configured' };
    }

    const key = String(objectKey || '').trim();
    if (!key) {
      return { success: false, error: 'Object key is required' };
    }

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'R2 delete failed' };
    }
  }
}

module.exports = R2StorageManager;