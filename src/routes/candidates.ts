import { Hono } from "hono";

const candidates = new Hono();

candidates.get("/", (c) => c.json({ message: "list candidates — coming soon" }));
candidates.get("/:id", (c) => c.json({ message: "get candidate — coming soon" }));

export default candidates;
