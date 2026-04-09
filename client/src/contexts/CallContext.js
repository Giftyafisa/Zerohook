/**
 * CallContext - Bridge between ChatSystem and CallSystem
 * 
 * Exposes startCall() so that any component (e.g. ChatSystem) can initiate
 * a call that gets handled by CallSystem's WebRTC pipeline.
 * 
 * CallSystem registers its startCall function here on mount.
 * Consumers call useCall().startCall(targetUserId, type).
 */
import React, { createContext, useContext, useRef, useCallback, useState } from 'react';

const CallContext = createContext({
  startCall: () => {},
  registerStartCall: () => {},
  isInCall: false,
  setIsInCall: () => {},
});

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const startCallRef = useRef(null);
  const pendingStartCallRef = useRef(null);
  const [isInCall, setIsInCall] = useState(false);

  // CallSystem registers its startCall implementation here
  const registerStartCall = useCallback((fn) => {
    startCallRef.current = fn;
    if (fn && pendingStartCallRef.current) {
      const pending = pendingStartCallRef.current;
      pendingStartCallRef.current = null;
      fn(pending.targetUserId, pending.type, pending.targetName);
    }
  }, []);

  // Any component can trigger a call via this function
  const startCall = useCallback((targetUserId, type = 'video', targetName = null) => {
    if (startCallRef.current) {
      startCallRef.current(targetUserId, type, targetName);
    } else {
      pendingStartCallRef.current = { targetUserId, type, targetName };
      console.warn('CallSystem not mounted — cannot start call');
    }
  }, []);

  const value = {
    startCall,
    registerStartCall,
    isInCall,
    setIsInCall,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};
