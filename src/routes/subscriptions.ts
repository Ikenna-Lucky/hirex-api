import { Hono } from "hono";

const subscriptions = new Hono();

subscriptions.post("/initialize", (c) => c.json({ message: "init payment — coming soon" }));
subscriptions.get("/plans", (c) => c.json({ message: "list plans — coming soon" }));
subscriptions.get("/status", (c) => c.json({ message: "subscription status — coming soon" }));

export default subscriptions;
