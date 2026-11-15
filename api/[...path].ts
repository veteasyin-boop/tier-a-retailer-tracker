/**
 * Root-level Vercel function bridge.
 * The project remains rooted at the Vite frontend; this exposes the Fastify API
 * from services/api without changing the Vercel project's root directory.
 */
export { default } from "../services/api/api/[...path].js";
