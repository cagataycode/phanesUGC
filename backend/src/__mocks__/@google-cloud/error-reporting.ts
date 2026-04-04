// Mock for @google-cloud/error-reporting
export class ErrorReporting {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config?: {
    projectId?: string;
    serviceContext?: { service: string; version: string };
    reportMode?: string;
  }) {
    // Mock constructor
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  report(_error: Error) {
    // Mock report method
  }
}
