/**
 * Shared test utilities for creating mock contexts
 */

// Mock user for authenticated tests
export const mockUser = {
  id: 999999,
  // Every real user carries one (the column defaults to 1 and is not nullable), so a
  // fixture without it would let a test pass against a query shape production cannot
  // produce — an org filter resolving to undefined, which reads as no filter at all.
  orgId: 1,
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
  orgId: mockUser.orgId,
};

// Mock context without user (unauthenticated)
export const mockUnauthContext = {
  user: null,
  orgId: null,
};

// Helper to create a mock context with custom user properties
export function createMockContext(userOverrides?: Partial<typeof mockUser>) {
  if (!userOverrides) {
    return mockAuthContext;
  }
  const user = { ...mockUser, ...userOverrides };
  return { user, orgId: user.orgId };
}
