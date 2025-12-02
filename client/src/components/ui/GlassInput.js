import React, { useState } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { styled } from '@mui/system';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

const GlassTextField = styled(TextField)(({ theme, focused }) => ({
  '& .MuiOutlinedInput-root': {
    fontFamily: '"Outfit", sans-serif',
    fontSize: '16px',
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(8px)',
    borderRadius: '16px',
    color: '#ffffff',
    transition: 'all 0.3s ease',
    
    '& fieldset': {
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      transition: 'all 0.3s ease',
    },
    
    '&:hover fieldset': {
      borderColor: 'rgba(0, 242, 234, 0.5)',
    },
    
    '&.Mui-focused fieldset': {
      borderColor: '#00f2ea',
      borderWidth: '2px',
      boxShadow: '0 0 20px rgba(0, 242, 234, 0.2)',
    },
    
    '&.Mui-error fieldset': {
      borderColor: '#ff0055',
    },
    
    '&.Mui-disabled': {
      background: 'rgba(255, 255, 255, 0.02)',
      '& fieldset': {
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
    },
    
    '& input': {
      color: '#ffffff',
      padding: '16px 20px',
      '&::placeholder': {
        color: 'rgba(255, 255, 255, 0.4)',
        opacity: 1,
      },
      '&:-webkit-autofill': {
        WebkitBoxShadow: '0 0 0 100px #1a1a1f inset',
        WebkitTextFillColor: '#ffffff',
      },
    },
    
    '& textarea': {
      color: '#ffffff',
      '&::placeholder': {
        color: 'rgba(255, 255, 255, 0.4)',
        opacity: 1,
      },
    },
  },
  
  '& .MuiInputLabel-root': {
    fontFamily: '"Outfit", sans-serif',
    color: 'rgba(255, 255, 255, 0.6)',
    '&.Mui-focused': {
      color: '#00f2ea',
    },
    '&.Mui-error': {
      color: '#ff0055',
    },
  },
  
  '& .MuiFormHelperText-root': {
    fontFamily: '"Outfit", sans-serif',
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: '14px',
    '&.Mui-error': {
      color: '#ff0055',
    },
  },
  
  '& .MuiInputAdornment-root': {
    color: 'rgba(255, 255, 255, 0.5)',
  },
}));

const GlassInput = ({
  type = 'text',
  label,
  placeholder,
  value,
  onChange,
  error,
  helperText,
  startIcon,
  endIcon,
  multiline,
  rows,
  maxRows,
  fullWidth = true,
  disabled,
  required,
  autoComplete,
  name,
  id,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  
  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };
  
  return (
    <GlassTextField
      type={isPassword ? (showPassword ? 'text' : 'password') : type}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      error={error}
      helperText={helperText}
      multiline={multiline}
      rows={rows}
      maxRows={maxRows}
      fullWidth={fullWidth}
      disabled={disabled}
      required={required}
      autoComplete={autoComplete}
      name={name}
      id={id}
      variant="outlined"
      InputProps={{
        startAdornment: startIcon ? (
          <InputAdornment position="start">{startIcon}</InputAdornment>
        ) : null,
        endAdornment: (
          <>
            {isPassword && (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleTogglePassword}
                  edge="end"
                  sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )}
            {endIcon && !isPassword && (
              <InputAdornment position="end">{endIcon}</InputAdornment>
            )}
          </>
        ),
      }}
      {...props}
    />
  );
};

export default GlassInput;
