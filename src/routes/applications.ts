import { Hono } from "hono";

const applications = new Hono();

applications.post("/", (c) => c.json({ message: "submit application — coming soon" }));
applications.get("/job/:jobId", (c) => c.json({ message: "list applications for job — coming soon" }));
applications.get("/:id", (c) => c.json({ message: "get application — coming soon" }));
applications.patch("/:id/stage", (c) => c.json({ message: "update stage — coming soon" }));

export default applications;
