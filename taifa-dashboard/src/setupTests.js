import '@testing-library/jest-dom/vitest';

// jsPDF dependencies need the Web Text APIs, which jsdom does not provide.
import { TextEncoder, TextDecoder } from 'node:util';

globalThis.TextEncoder = globalThis.TextEncoder || TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder || TextDecoder;
