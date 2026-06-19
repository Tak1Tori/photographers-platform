/** @type {import('next').NextConfig} */
const nextConfig = {
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
