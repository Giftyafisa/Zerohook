// Utility helpers for chat message type inference and preview formatting.
// This is shared between frontend chat UI components.

const normalizeDeclaredMessageType = (rawType) => {
  const value = String(rawType || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'text' || value.startsWith('text/')) return 'text';
  if (value === 'image' || value.startsWith('image/')) return 'image';
  if (value === 'video' || value.startsWith('video/')) return 'video';
  if (value === 'audio' || value.startsWith('audio/')) return 'audio';
  if (value === 'file' || value === 'location' || value === 'contact') return value;
  if (value.includes('/')) return 'file';
  return value;
};

export const inferMessageTypeFromContent = (content = '', explicitType = null, metadata = {}) => {
  const normalizedExplicitType = normalizeDeclaredMessageType(explicitType);
  const mimeType = String(metadata?.mimeType || metadata?.mimetype || '').toLowerCase();
  const fileName = String(metadata?.filename || metadata?.fileName || metadata?.name || '').toLowerCase();

  if (normalizedExplicitType && normalizedExplicitType !== 'text') return normalizedExplicitType;
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
  if (value.startsWith('blob:')) return 'file';
  if (/\/image\/upload\//.test(value)) return 'image';
  if (/\/video\/upload\//.test(value)) return 'video';
  if (/\.(jpe?g|png|gif|webp|heic|bmp|svg|tiff?)$/.test(value) || /image|photo|img/.test(value)) return 'image';
  if (/\.(mp4|mov|avi|webm|mkv|m4v|3gp)$/.test(value) || /video|vid/.test(value)) return 'video';
  if (/\.(mp3|wav|ogg|aac|flac|m4a|wma)$/.test(value) || /audio|voice/.test(value)) return 'audio';

  // Treat any URL-like string as a generic file.
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/uploads/') ||
    value.startsWith('uploads/') ||
    value.startsWith('data:')
  ) return 'file';

  return normalizedExplicitType || 'text';
};

export const formatMessagePreview = (content, messageType) => {
  const resolvedType = (() => {
    const explicitType = normalizeDeclaredMessageType(messageType);
    if (explicitType && explicitType !== 'text') {
      return explicitType;
    }

    return inferMessageTypeFromContent(content);
  })();
  const safeContent = typeof content === 'string' ? content : String(content || '');
  if (!resolvedType || resolvedType === 'text') return safeContent;

  switch (resolvedType) {
    case 'image': return '📷 Photo';
    case 'video': return '🎬 Video';
    case 'file': return '📎 File';
    case 'audio': return '🎵 Audio';
    case 'location': return '📍 Location';
    case 'contact': return '👤 Contact';
    default: return safeContent;
  }
};
