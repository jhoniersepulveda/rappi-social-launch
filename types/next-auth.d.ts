import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      email:           string
      name:            string
      role:            'kam' | 'restaurant' | 'admin'
      restaurantId?:   string
      restaurantName?: string
    } & DefaultSession['user']
  }

  interface User {
    role:            'kam' | 'restaurant' | 'admin'
    restaurantId?:   string
    restaurantName?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role:            'kam' | 'restaurant' | 'admin'
    restaurantId?:   string
    restaurantName?: string
  }
}
