const { inferMessageType } = require('./inferMessageType');

const EMOJI_LABEL_RE = /^[\u{1F4F7}\u{1F3AC}\u{1F3B5}\u{1F4CE}\u{1F4CD}\u{1F464}]/u;

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

const inferPreviewMessageType = ({ messageType, type, content, metadata = {} } = {}) => {
  const explicitType = normalizeDeclaredMessageType(messageType ?? type);

  if (explicitType && explicitType !== 'text') {
    return explicitType;
  }

  return inferMessageType({ content, metadata });
};

const formatMessagePreview = (content = '', messageType = 'text', metadata = {}, textLimit = 100) => {
  if (!content && !messageType) return '';

  if (typeof content === 'string' && EMOJI_LABEL_RE.test(content)) {
    return content;
  }

  const resolvedType = inferPreviewMessageType({ messageType, content: String(content || ''), metadata });

  switch (resolvedType) {
    case 'image':
      return '📷 Photo';
    case 'video':
      return '🎬 Video';
    case 'audio':
      return '🎵 Audio';
    case 'file':
      return '📎 File';
    case 'location':
      return '📍 Location';
    case 'contact':
      return '👤 Contact';
    default:
      break;
  }

  const safeContent = typeof content === 'string' ? content : String(content || '');
  return safeContent.substring(0, textLimit);
};

module.exports = {
  inferPreviewMessageType,
  formatMessagePreview
};