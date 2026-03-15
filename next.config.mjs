/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'replicate.delivery' },
      { protocol: 'https', hostname: 'oaidalleapiprodscus.blob.core.windows.net' },
      { protocol: 'https', hostname: 'images.rappi.com' },
      { protocol: 'https', hostname: 'images.rappi.com.co' },
      { protocol: 'https', hostname: 'images.rappi.com.mx' },
      { protocol: 'https', hostname: 'images.rappi.com.ar' },
      { protocol: 'https', hostname: 'images.rappi.pe' },
      { protocol: 'https', hostname: 'images.rappi.com.br' },
      { protocol: 'https', hostname: 'images.rappi.cl' },
    ],
  },
  // Allow server actions from the worker process
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'pdfkit', '@aws-sdk/client-s3'],
  },
}

export default nextConfig
