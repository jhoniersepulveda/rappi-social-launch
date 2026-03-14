export interface Product {
  name: string
  imageUrl: string
  price: number
}

export function suggestProduct(topProducts: Product[]): Product {
  if (!topProducts || topProducts.length === 0) {
    throw new Error('No products available')
  }
  // Select the highest-priced product as the hero promotional item
  return topProducts.reduce((best, current) =>
    current.price > best.price ? current : best
  )
}
