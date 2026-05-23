import { Hono } from "hono";

const auth = new Hono();

// Stubs — implemented in auth module bit
auth.post("/register", (c) => c.json({ message: "register — coming soon" }));
auth.post("/login", (c) => c.json({ message: "login — coming soon" }));
auth.post("/logout", (c) => c.json({ message: "logout — coming soon" }));
auth.get("/me", (c) => c.json({ message: "me — coming soon" }));

export default auth;
