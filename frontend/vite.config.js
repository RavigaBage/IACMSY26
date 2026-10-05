import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var backendTarget = env.VITE_BACKEND_URL || env.BACKEND_URL || (process.env.BACKEND_PORT ? "http://127.0.0.1:".concat(process.env.BACKEND_PORT) : 'http://127.0.0.1:3000');
    return {
        plugins: [react()],
        server: {
            port: 5173,
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: backendTarget,
                    changeOrigin: true,
                },
                '/socket.io': {
                    target: backendTarget,
                    ws: true,
                },
                '/uploads': {
                    target: backendTarget,
                    changeOrigin: true,
                }
            }
        }
    };
});
