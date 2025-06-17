// Mock WebSocket for testing WebSocket server behavior
export class WebSocket {
  readyState: number = 1; // OPEN
  send = jest.fn();
  close = jest.fn();
  ping = jest.fn();
  on = jest.fn();
  off = jest.fn();
  emit = jest.fn();

  // Helper methods for testing
  simulateMessage(data: any) {
    const handler = this.on.mock.calls.find((call: any) => call[0] === "message")?.[1];
    if (handler) handler(Buffer.from(JSON.stringify(data)));
  }

  simulateClose() {
    this.readyState = 3; // CLOSED
    const handler = this.on.mock.calls.find((call: any) => call[0] === "close")?.[1];
    if (handler) handler();
  }

  simulateError(error: Error) {
    const handler = this.on.mock.calls.find((call: any) => call[0] === "error")?.[1];
    if (handler) handler(error);
  }

  simulatePing() {
    const handler = this.on.mock.calls.find((call: any) => call[0] === "ping")?.[1];
    if (handler) handler();
  }
}

// Mock WebSocket Server
export const WebSocketServer = jest.fn().mockImplementation(function (this: any) {
  this.clients = new Set<WebSocket>();
  this.on = jest.fn();
  this.emit = jest.fn();
  this.close = jest.fn();
  this.options = { noServer: true };

  // Helper to simulate client connections
  this.simulateConnection = (url: string): WebSocket => {
    const ws = new WebSocket();
    this.clients.add(ws);

    // Get the connection handler
    const connectionHandler = this.on.mock.calls.find((call: any) => call[0] === "connection")?.[1];
    if (connectionHandler) {
      const req = { url, headers: {} };
      connectionHandler(ws, req);
    }

    return ws;
  };
});

// Re-export other necessary parts from the actual ws library
const actualWs = jest.requireActual("ws");
export const Receiver = actualWs.Receiver;
export const Sender = actualWs.Sender;
export default WebSocket;
