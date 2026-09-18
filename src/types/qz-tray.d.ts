declare module "qz-tray" {
  type Data = Array<{
    type: string;
    format: string;
    flavor: string;
    data: string;
  }>;
  type Config = {
    getPrinter(): { name: string };
    getOptions(): { copies: number; jobName: string };
  };
  const qz: {
    websocket: {
      isActive(): boolean;
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
    };
    printers: {
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
