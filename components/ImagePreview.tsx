'use client'

import Image from 'next/image'

type Variant = 'feed' | 'stories' | 'whatsapp'

interface ImagePreviewProps {
  url: string
  variant: Variant
  productName: string
}

const VARIANT_LABELS: Record<Variant, string> = {
  feed: 'Feed (1080×1080)',
  stories: 'Stories (1080×1920)',
  whatsapp: 'WhatsApp (1080×1350)',
}

const ASPECT_CLASSES: Record<Variant, string> = {
  feed: 'aspect-square',
  stories: 'aspect-[9/16]',
  whatsapp: 'aspect-[4/5]',
}

export default function ImagePreview({ url, variant, productName }: ImagePreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`relative w-full ${ASPECT_CLASSES[variant]} rounded-lg overflow-hidden shadow-lg bg-gray-100`}>
        <Image
          src={url}
          alt={`${productName} - ${VARIANT_LABELS[variant]}`}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <p className="text-center text-sm text-gray-500 font-medium">{VARIANT_LABELS[variant]}</p>
    </div>
  )
}
