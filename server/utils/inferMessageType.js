/**
 * Infer the logical message type from content URL patterns, MIME types,
 * file extensions, and data URIs. Shared across chat REST routes, Socket.IO
 * handlers, and the frontend. Single source of truth.
 *
 * @param {Object} opts
 * @param {string} [opts.messageType] - Explicitly declared message type
 * @param {string} [opts.type]        - Alias for messageType (socket payloads)
 * @param {string} [opts.content]     - Message text / URL
 * @param {Object} [opts.metadata]    - File metadata (mimeType, filename, etc.)
 * @returns {string} One of: 'text', 'image', 'video', 'audio', 'file', 'location', 'contact'
 */
function inferMessageType({ messageType, type, content, metadata = {} } = {}) {
  const directType = messageType ?? type;
  // Explicitly provided messageType/type should override inference (including 'text').
  // This keeps server behavior consistent with the client-side helper.
  if (directType) return directType;

  const mimeType = String(metadata?.mimeType || metadata?.mimetype || '').toLowerCase();
  const fileName = String(metadata?.filename || metadata?.fileName || metadata?.name || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType && !mimeType.startsWith('text/')) return 'file';
  if (/\.(jpe?g|png|gif|webp|heic|bmp|svg|tiff?)$/.test(fileName)) return 'image';
  if (/\.(mp4|mov|avi|webm|mkv|m4v|3gp)$/.test(fileName)) return 'video';
  if (/\.(mp3|wav|ogg|aac|flac|m4a|wma)$/.test(fileName)) return 'audio';

  const value = String(content || '').trim().toLowerCase().split('?')[0].split('#')[0];
  if (value.startsWith('data:image/')) return 'image';
  if (value.startsWith('data:video/')) return 'video';
  if (value.startsWith('data:audio/')) return 'audio';
  if (/\/image\/upload\//.test(value)) return 'image';
  if (/\/video\/upload\//.test(value)) return 'video';
  if (/\.(jpe?g|png|gif|webp|heic|bmp|svg|tiff?)$/.test(value) || /image|photo|img/.test(value)) return 'image';
  if (/\.(mp4|mov|avi|webm|mkv|m4v|3gp)$/.test(value) || /video|vid/.test(value)) return 'video';
  if (/\.(mp3|wav|ogg|aac|flac|m4a|wma)$/.test(value) || /audio|voice/.test(value)) return 'audio';
  // Fallback: treat links as file-like content
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/uploads/') || value.startsWith('data:')) return 'file';

  return 'text';
}

module.exports = { inferMessageType };
