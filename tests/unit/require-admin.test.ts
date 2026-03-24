import { describe, expect, it, vi } from "vitest";
import { requireAdmin } from "../../server/middleware/requireAdmin";

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("requireAdmin", () => {
  it("allows admin panel roles through", () => {
    const next = vi.fn();

    for (const role of ["admin", "owner", "manager", "staff", "csr"]) {
      const res = createResponse();
      requireAdmin({ user: { role } } as any, res as any, next);
      expect(next).toHaveBeenCalled();
      next.mockClear();
      expect(res.status).not.toHaveBeenCalled();
    }
  });

  it("blocks unauthenticated or unauthorized roles", () => {
    const next = vi.fn();
    const cases = [{}, { user: { role: "customer" } }, { user: { role: "guest" } }];

    for (const req of cases) {
      const res = createResponse();
      requireAdmin(req as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: "Forbidden" });
      expect(next).not.toHaveBeenCalled();
      next.mockClear();
    }
  });
});
