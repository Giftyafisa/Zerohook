import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Typography, Box } from '@mui/material';
import { styled, keyframes } from '@mui/system';
import CloseIcon from '@mui/icons-material/Close';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const GlassDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(8px)',
  },
  '& .MuiDialog-paper': {
    background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 242, 234, 0.1)',
    color: '#ffffff',
    maxWidth: '500px',
    width: '100%',
    margin: '16px',
    animation: `${fadeIn} 0.3s ease`,
    overflow: 'hidden',
    
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '1px',
      background: 'linear-gradient(90deg, transparent, rgba(0, 242, 234, 0.5), transparent)',
    },
  },
}));

const StyledDialogTitle = styled(DialogTitle)({
  fontFamily: '"Outfit", sans-serif',
  fontSize: '24px',
  fontWeight: 700,
  color: '#ffffff',
  padding: '24px 24px 16px',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const StyledDialogContent = styled(DialogContent)({
  padding: '0 24px 24px',
  color: 'rgba(255, 255, 255, 0.8)',
  fontFamily: '"Outfit", sans-serif',
  
  '&:first-of-type': {
    paddingTop: '0 !important',
  },
});

const StyledDialogActions = styled(DialogActions)({
  padding: '16px 24px 24px',
  gap: '12px',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  marginTop: '8px',
});

const CloseButton = styled(IconButton)({
  color: 'rgba(255, 255, 255, 0.5)',
  transition: 'all 0.2s ease',
  
  '&:hover': {
    color: '#00f2ea',
    background: 'rgba(0, 242, 234, 0.1)',
  },
});

const GlassModal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  icon,
  maxWidth = 'sm',
  fullWidth = true,
  showCloseButton = true,
  disableBackdropClick = false,
  ...props
}) => {
  const handleClose = (event, reason) => {
    if (disableBackdropClick && reason === 'backdropClick') {
      return;
    }
    onClose?.(event, reason);
  };
  
  return (
    <GlassDialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      {...props}
    >
      <StyledDialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {icon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 85, 0.2))',
                border: '1px solid rgba(0, 242, 234, 0.3)',
              }}
            >
              {React.cloneElement(icon, {
                sx: { color: '#00f2ea', fontSize: 24 },
              })}
            </Box>
          )}
          <Box>
            <Typography
              variant="h6"
              component="span"
              sx={{ 
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 700,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontFamily: '"Outfit", sans-serif',
                  mt: 0.5,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {showCloseButton && (
          <CloseButton onClick={onClose}>
            <CloseIcon />
          </CloseButton>
        )}
      </StyledDialogTitle>
      
      <StyledDialogContent>
        {children}
      </StyledDialogContent>
      
      {actions && (
        <StyledDialogActions>
          {actions}
        </StyledDialogActions>
      )}
    </GlassDialog>
  );
};

export default GlassModal;
