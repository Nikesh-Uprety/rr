import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const setLocationMock = vi.fn();
const useCurrentUserMock = vi.fn();
let currentLocation = "/admin";

vi.mock("wouter", () => ({
  useLocation: () => [currentLocation, setLocationMock],
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to the admin login", async () => {
    currentLocation = "/admin";
    useCurrentUserMock.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    render(
      <ProtectedRoute requireAdmin>
        <div>Secret</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith("/admin/login");
    });
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("blocks authenticated non-admin users from admin routes", async () => {
    currentLocation = "/admin";
    useCurrentUserMock.mockReturnValue({
      user: { id: "1", email: "user@example.com", role: "customer" },
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute requireAdmin>
        <div>Secret</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("renders children for authorized admin users", () => {
    currentLocation = "/admin";
    useCurrentUserMock.mockReturnValue({
      user: { id: "1", email: "admin@example.com", role: "admin" },
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute requireAdmin>
        <div>Secret</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Secret")).toBeInTheDocument();
  });

  it("redirects authenticated admin users away from blocked admin pages", async () => {
    currentLocation = "/admin/marketing";
    useCurrentUserMock.mockReturnValue({
      user: { id: "1", email: "staff@example.com", role: "staff" },
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute requiredAdminPage="marketing">
        <div>Secret</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith("/admin");
    });
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });
});
