const { inferMessageType } = require('../utils/inferMessageType');

describe('inferMessageType (server util)', () => {
  test('detects images from URL patterns', () => {
    expect(inferMessageType({ content: 'https://example.com/photo.jpg' })).toBe('image');
    expect(inferMessageType({ content: 'https://example.com/image/upload/v1/sample.png' })).toBe('image');
  });

  test('detects video from URL patterns', () => {
    expect(inferMessageType({ content: 'https://example.com/video.mp4' })).toBe('video');
    expect(inferMessageType({ content: 'https://example.com/video.webm' })).toBe('video');
  });

  test('treats legacy upload paths and blob URLs as files', () => {
    expect(inferMessageType({ content: 'uploads/legacy-upload-123' })).toBe('file');
    expect(inferMessageType({ content: 'blob:abc123' })).toBe('file');
  });

  test('explicit type overrides content inspection', () => {
    expect(inferMessageType({ content: 'hello world', messageType: 'audio' })).toBe('audio');
    expect(inferMessageType({ content: 'https://example.com/photo.jpg', type: 'text' })).toBe('image');
    expect(inferMessageType({ content: 'hello world', messageType: 'image/jpeg' })).toBe('image');
  });

  test('falls back to text when no media patterns match', () => {
    expect(inferMessageType({ content: 'hello world' })).toBe('text');
  });
});
