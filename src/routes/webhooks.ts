import { Hono } from "hono";

const webhooks = new Hono();

// Paystack payment webhook
webhooks.post("/paystack", (c) => c.json({ message: "paystack webhook — coming soon" }));

export default webhooks;
