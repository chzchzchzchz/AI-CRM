/**
 * Shared test utilities for creating mock contexts
 */

// Mock user for authenticated tests
export const mockUser = {
  id: 999999,
  openId: "test-open-id-12345",
  email: "test@example.com",
  name: "Test User",
  role: "admin" as const,
  isApproved: true,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock context with authenticated user
export const mockAuthContext = {
  user: mockUser,
};

// Mock context without user (unauthenticated)
export const mockUnauthContext = {
  user: null,
};

// Helper to create a mock context with custom user properties
export function createMockContext(userOverrides?: Partial<typeof mockUser>) {
  if (!userOverrides) {
    return mockAuthContext;
  }
  return {
    user: { ...mockUser, ...userOverrides },
  };
}
