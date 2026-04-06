// Mock for @google-cloud/logging
export class Logging {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config?: { projectId?: string }) {
    // Mock constructor
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  log(_name: string) {
    return {
      entry: jest.fn((metadata: unknown, data: unknown) => ({
        metadata,
        data,
      })),
      write: jest.fn().mockResolvedValue(undefined),
    };
  }
}
