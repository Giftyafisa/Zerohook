import { inferMessageTypeFromContent, formatMessagePreview } from './messageTypeUtils';

describe('messageTypeUtils', () => {
  test('infers image from common URL patterns', () => {
    expect(inferMessageTypeFromContent('https://example.com/photo.jpg')).toBe('image');
    expect(inferMessageTypeFromContent('https://res.cloudinary.com/demo/image/upload/v1/sample.jpg')).toBe('image');
  });

  test('infers video from URL patterns', () => {
    expect(inferMessageTypeFromContent('https://example.com/video.mp4')).toBe('video');
    expect(inferMessageTypeFromContent('https://example.com/path/to/vid.webm')).toBe('video');
  });

  test('infers audio from URL patterns', () => {
    expect(inferMessageTypeFromContent('https://example.com/track.mp3')).toBe('audio');
    expect(inferMessageTypeFromContent('https://example.com/voice.wav')).toBe('audio');
  });

  test('treats random links as file', () => {
    expect(inferMessageTypeFromContent('https://example.com/anything')).toBe('file');
  });

  test('falls back to text when nothing matches', () => {
    expect(inferMessageTypeFromContent('hello world')).toBe('text');
  });

  test('formatMessagePreview returns image label', () => {
    expect(formatMessagePreview('https://example.com/img.png')).toBe('📷 Photo');
  });

  test('formatMessagePreview returns video label', () => {
    expect(formatMessagePreview('https://example.com/video.mp4')).toBe('🎬 Video');
  });

  test('formatMessagePreview returns file label', () => {
    expect(formatMessagePreview('https://example.com/Foo.txt')).toBe('📎 File');
  });

  test('formatMessagePreview returns audio label', () => {
    expect(formatMessagePreview('https://example.com/voice.mp3')).toBe('🎵 Audio');
  });

  test('formatMessagePreview still infers media labels when explicit type is text', () => {
    expect(formatMessagePreview('https://example.com/photo.jpg', 'text')).toBe('📷 Photo');
    expect(formatMessagePreview('https://example.com/video.mp4', 'text')).toBe('🎬 Video');
  });

  test('formatMessagePreview respects explicit type override', () => {
    // Even though the content is plain text, the explicit type should dictate the preview
    expect(formatMessagePreview('hello world', 'audio')).toBe('🎵 Audio');
    expect(formatMessagePreview('hello world', 'image')).toBe('📷 Photo');
  });

  test('formatMessagePreview normalizes MIME-style explicit types', () => {
    expect(formatMessagePreview('hello world', 'image/jpeg')).toBe('📷 Photo');
    expect(formatMessagePreview('hello world', 'video/mp4')).toBe('🎬 Video');
  });

  test('formatMessagePreview falls back to text for plain messages', () => {
    expect(formatMessagePreview('hello world')).toBe('hello world');
  });
});
