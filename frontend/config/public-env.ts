const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "My Dear Partner",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000",
  enableAdminPortal: process.env.NEXT_PUBLIC_ENABLE_ADMIN_PORTAL === "true",
};

export { publicEnv };
