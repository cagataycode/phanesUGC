import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirestoreService } from './firestore.service';
import * as admin from 'firebase-admin';

// Control mock state outside the mock block to let it be toggleable
const mockApps: { name: string }[] = [];

jest.mock('firebase-admin', () => {
  const setMock = jest.fn();
  const updateMock = jest.fn();
  const addMock = jest.fn();
  const docMock = jest.fn(() => ({
    set: setMock,
    update: updateMock,
  }));
  const collectionMock = jest.fn(() => ({
    add: addMock,
  }));
  const settingsMock = jest.fn();

  const firestoreMock = jest.fn(() => ({
    settings: settingsMock,
    doc: docMock,
    collection: collectionMock,
  }));

  return {
    get apps() {
      return mockApps;
    },
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn(),
    },
    firestore: Object.assign(firestoreMock, {
      FieldValue: {
        serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
      },
    }),
  };
});

describe('FirestoreService', () => {
  let service: FirestoreService;
  let dbMock: {
    settings: jest.Mock;
    doc: jest.Mock;
    collection: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mockApps to empty for each test
    mockApps.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirestoreService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FIREBASE_PRIVATE_KEY') return 'my-key\\n';
              return 'test-value';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FirestoreService>(FirestoreService);
    // Execute module initialization manually for testing
    service.onModuleInit();
    dbMock = service.getFirestore() as unknown as typeof dbMock;
  });

  describe('Initialization', () => {
    it('should initialize firebase admin exactly once if no apps exist', () => {
      expect(admin.initializeApp).toHaveBeenCalledTimes(1);
      expect(admin.credential.cert).toHaveBeenCalledWith({
        projectId: 'test-value',
        clientEmail: 'test-value',
        privateKey: 'my-key\n',
      });
      expect(dbMock.settings).toHaveBeenCalledWith({
        ignoreUndefinedProperties: true,
      });
    });

    it('should not initialize firebase admin again if apps exist', () => {
      jest.clearAllMocks();
      // Push an app into the shared mockApps array
      mockApps.push({ name: '[DEFAULT]' });

      service.onModuleInit();

      expect(admin.initializeApp).not.toHaveBeenCalled();
      expect(admin.firestore).toHaveBeenCalled();
    });
  });

  describe('Data Operations', () => {
    const mockPath = 'collection/docId';
    const mockData = { testField: 'testValue' };

    it('should call doc() directly from firestore instance', () => {
      service.doc(mockPath);
      expect(dbMock.doc).toHaveBeenCalledWith(mockPath);
    });

    it('should call collection() directly from firestore instance', () => {
      service.collection('collection');
      expect(dbMock.collection).toHaveBeenCalledWith('collection');
    });

    it('should set data and append updatedAt timestamp', async () => {
      await service.set(mockPath, mockData);

      expect(dbMock.doc).toHaveBeenCalledWith(mockPath);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(dbMock.doc(mockPath).set).toHaveBeenCalledWith(
        {
          ...mockData,
          updatedAt: 'MOCK_TIMESTAMP',
        },
        { merge: true },
      );
    });

    it('should add data and append createdAt and updatedAt timestamps', async () => {
      await service.add('collection', mockData);

      expect(dbMock.collection).toHaveBeenCalledWith('collection');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(dbMock.collection('collection').add).toHaveBeenCalledWith({
        ...mockData,
        createdAt: 'MOCK_TIMESTAMP',
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });

    it('should update data and append updatedAt timestamp', async () => {
      await service.update(mockPath, mockData);

      expect(dbMock.doc).toHaveBeenCalledWith(mockPath);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(dbMock.doc(mockPath).update).toHaveBeenCalledWith({
        ...mockData,
        updatedAt: 'MOCK_TIMESTAMP',
      });
    });
  });
});
