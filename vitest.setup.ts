import "@testing-library/jest-dom";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(__dirname, ".env.local") });

// Mock Web Crypto API for Node.js environment
if (typeof global.crypto === "undefined") {
  const { webcrypto } = require("crypto");
  global.crypto = webcrypto as Crypto;
}

// Mock TextEncoder/TextDecoder if not available
if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
