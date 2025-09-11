// Global setup for Mocha API/action tests.
// Mock next/cache so server action imports (revalidatePath) don't throw in plain Node.
import Module from 'module';
const originalLoad = (Module as any)._load;
(Module as any)._load = function(request: string, parent: any, isMain: boolean) {
  if (request === 'next/cache') {
    return { revalidatePath: (_path: string) => {} };
  }
  return originalLoad.apply(this, arguments as any);
};
