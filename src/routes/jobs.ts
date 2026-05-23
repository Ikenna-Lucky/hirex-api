import { Hono } from "hono";

const jobs = new Hono();

jobs.get("/", (c) => c.json({ message: "list jobs — coming soon" }));
jobs.post("/", (c) => c.json({ message: "create job — coming soon" }));
jobs.get("/:id", (c) => c.json({ message: "get job — coming soon" }));
jobs.patch("/:id", (c) => c.json({ message: "update job — coming soon" }));
jobs.delete("/:id", (c) => c.json({ message: "delete job — coming soon" }));

export default jobs;
