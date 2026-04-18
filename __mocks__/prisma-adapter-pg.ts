// Shim for @prisma/adapter-pg — prevents Jest from loading native pg bindings.
export const PrismaPg = jest.fn().mockImplementation(() => ({}))
