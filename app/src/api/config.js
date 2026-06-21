// ----------------------------------------------------------------
// API base URL
//
// IMPORTANT (phone testing with Expo Go):
//   Your phone is a DIFFERENT device from your PC, so "localhost" /
//   "127.0.0.1" will NOT work — those point to the phone itself.
//   Use your PC's LAN IP address (same Wi-Fi network as the phone).
//
//   Detected PC LAN IP at setup time: 192.168.0.8
//   If your IP changes, run `ipconfig` and update the line below.
// ----------------------------------------------------------------

export const LAN_IP = '192.168.0.8';
export const API_PORT = 4000;

export const API_BASE_URL = `http://${LAN_IP}:${API_PORT}`;
export const API_URL = `${API_BASE_URL}/api`;
