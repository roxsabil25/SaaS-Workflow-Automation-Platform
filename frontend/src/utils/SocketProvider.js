import { io } from "socket.io-client";
import { createSocketDebugger } from './SocketDebug';

// Create socket connection with proper configuration
export const socket = io(process.env.REACT_APP_SERVER_URL || "http://localhost:5000", {
  transports: ["websocket", "polling"],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  forceNew: false,
  autoConnect: true
});

// Initialize debugger for development
export const socketDebugger = createSocketDebugger(socket);

// Add connection event listeners for debugging
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  socketDebugger.log('connect', 'Socket connection established', { 
    socketId: socket.id,
    transport: socket.io.engine?.transport?.name 
  });
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
  socketDebugger.log('disconnect', 'Socket disconnected', { reason });
});

socket.on('connect_error', (error) => {
  console.error('🔌 Socket connection error:', error);
  socketDebugger.log('error', 'Socket connection error', { 
    error: error.message,
    stack: error.stack 
  });
});

socket.on('reconnect', (attemptNumber) => {
  console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
  socketDebugger.log('success', 'Socket reconnected', { attemptNumber });
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('🔄 Attempting to reconnect...', attemptNumber);
  socketDebugger.log('info', 'Attempting to reconnect', { attemptNumber });
});

// Make debugger globally available for debugging in console
if (process.env.NODE_ENV === 'development') {
  window.socketDebugger = socketDebugger;
  console.log('🔍 Socket debugger available at window.socketDebugger');
  console.log('- Use socketDebugger.getDebugInfo() to get current debug info');
  console.log('- Use socketDebugger.exportLogs() to export debug logs');
}
