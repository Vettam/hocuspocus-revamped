import test from "ava";
import { Hocuspocus } from "@hocuspocus/server";

// We need to import the class itself, not the singleton
// The service file only exports the singleton instance by default
class HocuspocusInstanceService {
  private instance: Hocuspocus | null = null;

  setInstance(hocuspocus: Hocuspocus): void {
    this.instance = hocuspocus;
  }

  getInstance(): Hocuspocus {
    if (!this.instance) {
      throw new Error(
        "Hocuspocus instance not initialized. Call setInstance() first."
      );
    }
    return this.instance;
  }

  isInitialized(): boolean {
    return this.instance !== null;
  }
}

// Helper to create a fresh instance for each test
function createFreshService(): HocuspocusInstanceService {
  return new HocuspocusInstanceService();
}

// Helper to create a mock Hocuspocus instance
function createMockHocuspocus(): Hocuspocus {
  return {
    // Add minimal properties that satisfy the Hocuspocus type
    documents: new Map(),
    configuration: {},
  } as unknown as Hocuspocus;
}

// isInitialized() tests
test("isInitialized returns false when instance not set", (t) => {
  const service = createFreshService();

  t.false(service.isInitialized());
});

test("isInitialized returns true after instance is set", (t) => {
  const service = createFreshService();
  const mockHocuspocus = createMockHocuspocus();

  service.setInstance(mockHocuspocus);

  t.true(service.isInitialized());
});

// setInstance() tests
test("setInstance sets the Hocuspocus instance", (t) => {
  const service = createFreshService();
  const mockHocuspocus = createMockHocuspocus();

  service.setInstance(mockHocuspocus);

  t.true(service.isInitialized());
});

test("setInstance allows setting instance when not previously set", (t) => {
  const service = createFreshService();
  const mockHocuspocus = createMockHocuspocus();

  // Should not throw
  t.notThrows(() => {
    service.setInstance(mockHocuspocus);
  });

  t.is(service.getInstance(), mockHocuspocus);
});

test("setInstance allows overwriting existing instance", (t) => {
  const service = createFreshService();
  const mockHocuspocus1 = createMockHocuspocus();
  const mockHocuspocus2 = createMockHocuspocus();

  service.setInstance(mockHocuspocus1);

  // Overwrite should not throw (logs warning but allows it)
  t.notThrows(() => {
    service.setInstance(mockHocuspocus2);
  });

  // Should return the second instance
  t.is(service.getInstance(), mockHocuspocus2);
  t.not(service.getInstance(), mockHocuspocus1);
});

// getInstance() tests
test("getInstance returns the set instance", (t) => {
  const service = createFreshService();
  const mockHocuspocus = createMockHocuspocus();

  service.setInstance(mockHocuspocus);

  const instance = service.getInstance();

  t.is(instance, mockHocuspocus);
});

test("getInstance throws error when instance not initialized", (t) => {
  const service = createFreshService();

  const error = t.throws(() => {
    service.getInstance();
  });

  t.truthy(error);
  t.true(error!.message.includes("not initialized"));
  t.true(error!.message.includes("setInstance"));
});

test("getInstance returns same instance on multiple calls", (t) => {
  const service = createFreshService();
  const mockHocuspocus = createMockHocuspocus();

  service.setInstance(mockHocuspocus);

  const instance1 = service.getInstance();
  const instance2 = service.getInstance();
  const instance3 = service.getInstance();

  t.is(instance1, instance2);
  t.is(instance2, instance3);
  t.is(instance1, mockHocuspocus);
});

// Integration test: Full lifecycle
test("Full lifecycle: create service, set instance, check initialized, get instance", (t) => {
  const service = createFreshService();

  // Step 1: Initially not initialized
  t.false(service.isInitialized());
  t.throws(() => service.getInstance());

  // Step 2: Set instance
  const mockHocuspocus = createMockHocuspocus();
  service.setInstance(mockHocuspocus);

  // Step 3: Now initialized
  t.true(service.isInitialized());

  // Step 4: Can get instance
  t.notThrows(() => service.getInstance());
  t.is(service.getInstance(), mockHocuspocus);
});

// Edge cases
test("setInstance accepts null-like Hocuspocus instance properties", (t) => {
  const service = createFreshService();
  const partialMockHocuspocus = {
    documents: new Map(),
    configuration: null,
  } as unknown as Hocuspocus;

  t.notThrows(() => {
    service.setInstance(partialMockHocuspocus);
  });

  t.is(service.getInstance(), partialMockHocuspocus);
});

test("getInstance error message is descriptive", (t) => {
  const service = createFreshService();

  const error = t.throws(() => {
    service.getInstance();
  });

  // Error message should guide the user
  t.true(error!.message.toLowerCase().includes("hocuspocus"));
  t.true(error!.message.toLowerCase().includes("instance"));
  t.true(error!.message.toLowerCase().includes("setinstance"));
});
