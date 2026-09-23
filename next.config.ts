import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "unpdf", "tesseract.js", "sharp", "@google/genai"],
};

export default nextConfig;
