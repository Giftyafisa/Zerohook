// Glass-morphism UI Components for Zerohook
// Modern, neon-accented components with backdrop blur effects

export { default as AnimatedBackground } from './AnimatedBackground';
export { default as GlassCard } from './GlassCard';
export { default as GlassButton } from './GlassButton';
export { default as GlassInput } from './GlassInput';
export { default as GlassModal } from './GlassModal';
export { default as GlassAvatar } from './GlassAvatar';
export { default as ProfileCard } from './ProfileCard';
export { default as FilterTabs } from './FilterTabs';
export { default as SafetyBanner } from './SafetyBanner';
export { ToastProvider, useToast } from './Toast';

// Usage Examples:
// 
// import { 
//   AnimatedBackground, 
//   GlassCard, 
//   GlassButton, 
//   GlassInput,
//   GlassModal,
//   GlassAvatar,
//   ProfileCard,
//   ToastProvider,
//   useToast 
// } from './components/ui';
//
// <AnimatedBackground /> - Floating gradient blobs background
// <GlassCard variant="neon">Content</GlassCard> - Glass-morphism card
// <GlassButton variant="primary">Click Me</GlassButton> - Styled button
// <GlassInput label="Email" type="email" /> - Glass input field
// <GlassModal open={true} title="Modal Title">Content</GlassModal>
// <GlassAvatar src="url" isOnline isPremium /> - Avatar with status
// <ProfileCard name="Jane" age={25} price={5000} /> - Full profile card
// 
// For Toast notifications:
// Wrap app with <ToastProvider>
// const toast = useToast();
// toast.success('Message saved!');
// toast.error('Something went wrong');
