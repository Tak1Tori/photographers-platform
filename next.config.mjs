/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/offer": ["./legal-source/offer-v1.txt"],
    "/payment-and-refund": ["./legal-source/payment-and-refund-v3.txt"],
    "/cookies": ["./legal-source/cookies-v1.txt"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "150mb"
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com"
      },
      {
        protocol: "https",
        hostname: "static.wikia.nocookie.net"
      },
      {
        protocol: "https",
        hostname: "qiwlwbxznhuwcwpftaak.supabase.co"
      }
    ]
  }
};

export default nextConfig;
