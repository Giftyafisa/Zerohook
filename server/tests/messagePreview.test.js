const { formatMessagePreview } = require('../utils/messagePreview');

describe('messagePreview helper', () => {
  test('formats raw image URLs as photo previews even when messageType is text', () => {
    expect(formatMessagePreview('https://example.com/photo.jpg', 'text')).toBe('📷 Photo');
  });

  test('formats raw video URLs as video previews even when messageType is text', () => {
    expect(formatMessagePreview('https://example.com/video.mp4', 'text')).toBe('🎬 Video');
  });

  test('formats legacy upload paths as file previews', () => {
    expect(formatMessagePreview('uploads/legacy-upload-123', 'text')).toBe('📎 File');
  });

  test('keeps plain text messages intact', () => {
    expect(formatMessagePreview('hello world', 'text')).toBe('hello world');
  });

  test('respects explicit media message types', () => {
    expect(formatMessagePreview('https://example.com/anything', 'audio')).toBe('🎵 Audio');
  });

  test('normalizes MIME-style explicit media types', () => {
    expect(formatMessagePreview('hello world', 'image/jpeg')).toBe('📷 Photo');
    expect(formatMessagePreview('hello world', 'video/mp4')).toBe('🎬 Video');
  });
});