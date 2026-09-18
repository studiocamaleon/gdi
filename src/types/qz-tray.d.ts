declare module "qz-tray" {
  type Data = Array<{
    type: string;
    format: string;
    flavor: string;
    data: string;
  }>;
  type Config = {
    getPrinter(): { name: string };
    getOptions(): { copies: number; jobName: string; [key: string]: unknown };
  };
  const qz: {
    websocket: {
      isActive(): boolean;
      setClosedCallbacks(callback: () => void): void;
      connect(options: {
        host: string;
        usingSecure: boolean;
        port: { secure: number[] };
        retries: number;
        delay: number;
        keepAlive: number;
      }): Promise<void>;
      disconnect(): Promise<void>;
    };
    security: {
      setCertificatePromise(
        provider: (
          resolve: (certificate: string) => void,
          reject: (error: Error) => void,
        ) => void,
      ): void;
      setSignatureAlgorithm(algorithm: "SHA512"): void;
      setSignaturePromise(
        provider: (
          hash: string,
        ) => (
          resolve: (signature: string) => void,
          reject: (error: Error) => void,
        ) => void,
      ): void;
    };
    api: {
      getVersion(): Promise<string>;
      setWebSocketType(type: unknown): void;
      setSha256Type(hasher: (message: string) => Promise<string>): void;
    };
    printers: {
      startListening(printer: string): Promise<void>;
      stopListening(): Promise<void>;
      getStatus(): Promise<void>;
      setPrinterCallbacks(callback: (event: unknown) => void): void;
      find(
        query?: string,
        signature?: string,
        timestamp?: number,
      ): Promise<string[]>;
    };
    print(
      config: Config,
      data: Data,
      signature?: string | string[],
      timestamp?: number,
    ): Promise<void>;
  };
  export default qz;
}
