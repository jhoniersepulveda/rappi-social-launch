/**
 * Production auth providers — stubs for future Rappi SSO integration.
 *
 * CURRENT STATE: Using a temporary credentials provider in lib/auth.ts
 * for development. The actual implementation goes here once Rappi IT
 * provides the integration details.
 */

// TODO: conectar con SSO de Rappi (SAML/OAuth)
//   - Rappi usa Okta/Azure AD internamente
//   - Se necesita: clientId, clientSecret, issuerUrl del tenant de Rappi
//   - Provider sugerido: next-auth/providers/okta o providers/azure-ad
//   - Una vez conectado, eliminar el CredentialsProvider temporal de lib/auth.ts

// TODO: validar contra API interna de Rappi
//   - Endpoint: GET /internal/v1/users/:email/permissions
//   - Headers: Authorization: Bearer <service-account-token>
//   - Respuesta esperada: { userId, name, email, storeIds: string[], isKAM: boolean }
//   - Usar storeIds[0] como restaurantId en la sesión

// TODO: roles vienen del token de Rappi
//   - El JWT de Rappi ya incluye claims de rol (groups/scopes)
//   - Mapear: group "rappi-social-admin" → admin, "kam" / "comercial" → kam
//   - Restaurantes: presencia de storeIds en el token → restaurant
//   - Reemplazar getRoleFromRappiEmail() en lib/auth/roles.ts con lectura del token

// TODO: rappi_store_id
//   - Los restaurantes se identifican por su rappi_store_id (ej: "12345")
//   - En producción, el token incluirá los storeIds asociados al email del operador
//   - Guardar en session.user.rappiStoreId y usar para filtrar kits en la DB

// ─── Ejemplo de cómo quedará lib/auth.ts con OAuth real ──────────────────────
//
// import RappiSSOProvider from './providers'   ← este archivo
//
// providers: [
//   RappiSSOProvider,                          ← reemplaza CredentialsProvider
// ],
//
// callbacks: {
//   jwt({ token, account, profile }) {
//     if (account?.provider === 'rappi-sso') {
//       token.role = getRoleFromRappiToken(profile)   ← lib/auth/roles.ts
//       token.rappiStoreIds = profile.storeIds
//     }
//     return token
//   }
// }
// ─────────────────────────────────────────────────────────────────────────────

export {}   // keeps this a module; replace with actual provider export when ready
