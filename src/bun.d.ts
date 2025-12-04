// Minimal Bun type declarations for term-mcp

declare global {
  const Bun: {
    serve(options: {
      port: number;
      hostname?: string;
      fetch: (req: Request, server: BunServer) => Promise<Response | undefined> | Response | undefined;
      websocket?: {
        open?: (ws: ServerWebSocket) => void;
        message?: (ws: ServerWebSocket, message: string | Buffer) => void;
        close?: (ws: ServerWebSocket) => void;
      };
    }): BunServer;
  };

  interface BunServer {
    stop(): void;
    upgrade(req: Request, options?: { data?: unknown }): boolean;
  }

  interface ServerWebSocket {
    data: unknown;
    send(data: string | BufferSource): void;
    close(): void;
  }
}

export {};
