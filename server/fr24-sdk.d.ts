declare module '@flightradar24/fr24sdk' {
  const SDK: {
    Client: new (options: { apiToken: string; timeout?: number; httpClient?: { request(options: { url: string; params?: Record<string, unknown> }): Promise<{ data: unknown }> } }) => {
      live: { getFull(params: { bounds: string; limit: number }): Promise<unknown> };
      close(): void;
    };
  };
  export default SDK;
}
