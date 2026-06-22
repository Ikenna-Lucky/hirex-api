import { describe, it, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test_secret_must_be_at_least_32_chars_ok";
process.env.CLOUDINARY_CLOUD_NAME = "test";
process.env.CLOUDINARY_API_KEY = "test";
process.env.CLOUDINARY_API_SECRET = "test";

// ─── DB mock ───────────────────────────────────────────
// selectQueue: each select call dequeues the next result set
const dbMock = {
  selectQueue: [] as any[][],
  insertRows: [] as any[],
};

mock.module("../db", () => {
  const makeChain = (getRows: () => any[]): any => {
    const obj: any = {
      from: () => obj,
      innerJoin: () => obj,
      where: () => obj,
      orderBy: () => obj,
      offset: () => obj,
      set: () => obj,
      values: () => obj,
      groupBy: () => Promise.resolve([]),
      limit: () => {
        const rows = getRows();
        const p: any = Promise.resolve(rows);
        p.offset = () => Promise.resolve(rows);
        return p;
      },
      returning: () => Promise.resolve(getRows()),
      // Makes plain `await insert().values()` resolve to undefined
      then: (res: any, rej: any) => Promise.resolve(undefined).then(res, rej),
    };
    return obj;
  };

  return {
    db: {
      select: () => makeChain(() => dbMock.selectQueue.shift() ?? []),
      insert: () => makeChain(() => dbMock.insertRows),
      update: () => makeChain(() => dbMock.insertRows),
      delete: () => ({ where: () => Promise.resolve(undefined) }),
    },
  };
});

// Mock Cloudinary so logo upload doesn't make real HTTP calls
mock.module("../lib/cloudinary", () => ({
  uploadLogo: async () => ({ url: "https://cloudinary.com/logo.png" }),
}));

// Mock ioredis (used by rate limiter)
mock.module("ioredis", () => ({
  default: class MockRedis {
    on() {
      return this;
    }
    async incr() {
      return 1;
    }
    async expire() {
      return 1;
    }
  },
}));

import authRoutes from "../routes/auth";
import { signToken } from "../lib/jwt";

// Build a minimal app that mounts only auth routes
const app = new Hono().basePath("/api");
app.route("/auth", authRoutes);

// ─── Helpers ───────────────────────────────────────────
const VALID_REGISTER = {
  name: "Acme Corp",
  email: "hr@acme.com",
  password: "Password123",
  industry: "Technology",
};

async function makeToken(sub = "company-1") {
  return signToken({ sub, email: "hr@acme.com", name: "Acme Corp" });
}

function post(path: string, body: unknown, token?: string) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function get(path: string, token?: string) {
  return app.request(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ─── Tests ─────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    dbMock.selectQueue = [];
    dbMock.insertRows = [];
  });

  it("returns 201 and tokens on successful registration", async () => {
    // No existing company found
    dbMock.selectQueue = [[]];
    // Company returned from insert
    dbMock.insertRows = [
      {
        id: "company-1",
        name: "Acme Corp",
        email: "hr@acme.com",
        industry: "Technology",
        createdAt: new Date(),
      },
    ];

    const res = await post("/api/auth/register", VALID_REGISTER);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.token).toBe("string");
    expect(typeof body.data.refreshToken).toBe("string");
    expect(body.data.company.email).toBe("hr@acme.com");
  });

  it("returns 409 when email is already registered", async () => {
    // Existing company found
    dbMock.selectQueue = [[{ id: "existing-company" }]];

    const res = await post("/api/auth/register", VALID_REGISTER);
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 for invalid request body", async () => {
    const res = await post("/api/auth/register", {
      name: "X",
      email: "not-an-email",
      password: "weak",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await post("/api/auth/register", { name: "Acme" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await Bun.password.hash("Password123", {
      algorithm: "argon2id",
      memoryCost: 4,
      timeCost: 3,
    });
  });

  beforeEach(() => {
    dbMock.selectQueue = [];
    dbMock.insertRows = [];
  });

  it("returns 200 and tokens on valid credentials", async () => {
    dbMock.selectQueue = [
      [
        {
          id: "company-1",
          name: "Acme Corp",
          email: "hr@acme.com",
          passwordHash,
          logoUrl: null,
          industry: "Technology",
          size: "1-10",
          isVerified: false,
        },
      ],
    ];

    const res = await post("/api/auth/login", {
      email: "hr@acme.com",
      password: "Password123",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.token).toBe("string");
    expect(typeof body.data.refreshToken).toBe("string");
  });

  it("returns 401 for wrong password", async () => {
    dbMock.selectQueue = [
      [
        {
          id: "company-1",
          email: "hr@acme.com",
          passwordHash,
        },
      ],
    ];

    const res = await post("/api/auth/login", {
      email: "hr@acme.com",
      password: "WrongPassword1",
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 when email does not exist", async () => {
    dbMock.selectQueue = [[]]; // no company found

    const res = await post("/api/auth/login", {
      email: "nobody@acme.com",
      password: "Password123",
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid request body", async () => {
    const res = await post("/api/auth/login", { email: "bademail" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    dbMock.selectQueue = [];
  });

  it("returns 401 when no token is provided", async () => {
    const res = await get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns company data for an authenticated request", async () => {
    dbMock.selectQueue = [
      [
        {
          id: "company-1",
          name: "Acme Corp",
          email: "hr@acme.com",
          logoUrl: null,
          website: null,
          industry: "Technology",
          size: "1-10",
          location: null,
          description: null,
          isVerified: false,
          createdAt: new Date(),
        },
      ],
    ];

    const token = await makeToken("company-1");
    const res = await get("/api/auth/me", token);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.company.name).toBe("Acme Corp");
  });
});

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    dbMock.selectQueue = [];
    dbMock.insertRows = [];
  });

  it("returns 400 when refresh token is missing", async () => {
    const res = await post("/api/auth/refresh", {});
    expect(res.status).toBe(400);
  });

  it("returns 401 for an invalid refresh token", async () => {
    dbMock.selectQueue = [[]]; // token not found in DB

    const res = await post("/api/auth/refresh", {
      refreshToken: "invalid-token-xyz",
    });
    expect(res.status).toBe(401);
  });

  it("returns new tokens for a valid refresh token", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // First select: find the refresh token
    // Second select: find the company
    dbMock.selectQueue = [
      [
        {
          id: "token-1",
          companyId: "company-1",
          token: "valid-token",
          expiresAt: futureDate,
        },
      ],
      [{ id: "company-1", email: "hr@acme.com", name: "Acme Corp" }],
    ];

    const res = await post("/api/auth/refresh", {
      refreshToken: "valid-token",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.token).toBe("string");
    expect(typeof body.data.refreshToken).toBe("string");
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await post("/api/auth/logout", {});
    expect(res.status).toBe(401);
  });

  it("returns 200 and logs out an authenticated user", async () => {
    const token = await makeToken();
    const res = await post("/api/auth/logout", {}, token);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
