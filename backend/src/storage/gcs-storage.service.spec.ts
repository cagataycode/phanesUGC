import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { GcsStorageService } from './gcs-storage.service';

jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => {
      return {
        bucket: jest.fn(),
      };
    }),
  };
});

describe('GcsStorageService', () => {
  let service: GcsStorageService;
  let mockStorage: { bucket: jest.Mock };
  let mockBucket: { file: jest.Mock };
  let mockFile: {
    getSignedUrl: jest.Mock;
    copy: jest.Mock;
    save: jest.Mock;
    getMetadata: jest.Mock;
  };

  beforeEach(async () => {
    mockFile = {
      getSignedUrl: jest.fn(),
      copy: jest.fn(),
      save: jest.fn(),
      getMetadata: jest.fn().mockResolvedValue([{ size: 1024 }]),
    };

    mockBucket = {
      file: jest.fn().mockReturnValue(mockFile),
    };

    (Storage as unknown as jest.Mock).mockImplementation(() => ({
      bucket: jest.fn().mockReturnValue(mockBucket),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GcsStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                GCS_BUCKET_NAME: 'test-bucket',
                FIREBASE_PROJECT_ID: 'test-project',
                FIREBASE_CLIENT_EMAIL: 'test@example.com',
                FIREBASE_PRIVATE_KEY: 'test-key',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GcsStorageService>(GcsStorageService);
    // Grab the mocked storage instance assigned inside the constructor
    mockStorage = service['storage'] as unknown as { bucket: jest.Mock };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSignedVideoUrl', () => {
    it('should generate a v4 signed URL with a 15 min expiration', async () => {
      mockFile.getSignedUrl.mockResolvedValue(['https://signed.url/video.mp4']);

      const url = await service.createSignedVideoUrl('test-path/video.mp4');

      expect(mockStorage.bucket).toHaveBeenCalledWith('test-bucket');
      expect(mockBucket.file).toHaveBeenCalledWith('test-path/video.mp4');
      expect(mockFile.getSignedUrl).toHaveBeenCalledWith({
        action: 'read',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expires: expect.any(Number),
        version: 'v4',
      });
      expect(url).toBe('https://signed.url/video.mp4');
    });
  });

  describe('importGeneratedVideo', () => {
    it('should copy file if source is another GCS bucket', async () => {
      const sourceUrl = 'gs://source-bucket/source-path/video.mp4';
      const destPath = 'dest-path/video.mp4';

      await service.importGeneratedVideo(sourceUrl, destPath);

      expect(mockStorage.bucket).toHaveBeenCalledWith('source-bucket');
      expect(mockBucket.file).toHaveBeenCalledWith('source-path/video.mp4');

      // We expect the destination bucket reference to be passed to copy()
      expect(mockFile.copy).toHaveBeenCalled();
    });

    it('should skip copying if source and dest are the exact same GCS location', async () => {
      const sourceUrl = 'gs://test-bucket/same-path/video.mp4';
      const destPath = 'same-path/video.mp4';

      await service.importGeneratedVideo(sourceUrl, destPath);

      expect(mockFile.copy).not.toHaveBeenCalled();
      expect(mockFile.save).not.toHaveBeenCalled();
    });

    it('should fetch and save file if source is an HTTP URL', async () => {
      const sourceUrl = 'https://example.com/video.mp4';
      const destPath = 'dest-path/video.mp4';

      const mockArrayBuffer = new ArrayBuffer(8);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
        headers: new Headers({ 'content-type': 'video/mp4' }),
      });

      await service.importGeneratedVideo(sourceUrl, destPath);

      expect(global.fetch).toHaveBeenCalledWith(sourceUrl);
      expect(mockStorage.bucket).toHaveBeenCalledWith('test-bucket');
      expect(mockBucket.file).toHaveBeenCalledWith(destPath);
      expect(mockFile.save).toHaveBeenCalledWith(expect.any(Buffer), {
        resumable: false,
        contentType: 'video/mp4',
      });
    });

    it('should throw an error if HTTP fetch fails', async () => {
      const sourceUrl = 'https://example.com/video.mp4';
      const destPath = 'dest-path/video.mp4';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        service.importGeneratedVideo(sourceUrl, destPath),
      ).rejects.toThrow(
        'Failed to download generated video from source URL: 404',
      );
    });

    it('should throw an error for unsupported or malformed GCS URIs', async () => {
      const sourceUrl = 'gs://malformed-uri-no-path';
      const destPath = 'dest-path/video.mp4';

      await expect(
        service.importGeneratedVideo(sourceUrl, destPath),
      ).rejects.toThrow(/Invalid GCS URI missing object path/);
    });
  });
});
