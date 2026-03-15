import sgMail from '@sendgrid/mail'

const SENDGRID_CONFIGURED = !!process.env.SENDGRID_API_KEY
if (SENDGRID_CONFIGURED) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!)
}

const FROM_EMAIL = 'noreply@rappisociallaunch.com'
const FROM_NAME = 'Rappi Social Launch'

function buildReminderHtml(restaurantName: string, restaurantId: string): string {
  const ctaUrl = `${process.env.NEXTAUTH_URL}/kit/new?restaurantId=${restaurantId}`
  const month = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #FF441B; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; }
    .body { padding: 32px 24px; }
    .body h2 { color: #1A1A1A; font-size: 22px; }
    .body p { color: #555; line-height: 1.6; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a { background: #FF441B; color: white; padding: 16px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; }
    .footer { background: #1A1A1A; color: #aaa; padding: 16px 24px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>rappi</h1>
      <p>Social Launch — Tu kit de redes sociales</p>
    </div>
    <div class="body">
      <h2>Hola, ${restaurantName} 👋</h2>
      <p>Ya es ${month} y notamos que llevas más de 30 días sin crear un kit de redes sociales en Rappi Social Launch.</p>
      <p>Generar y publicar tu kit puede ayudarte a <strong>aumentar tus ventas hasta un 30%</strong> con clientes que descubren tu restaurante en redes sociales.</p>
      <p>Te tomará menos de 2 minutos crear piezas profesionales con IA, listas para publicar en Instagram, Facebook y WhatsApp.</p>
      <div class="cta">
        <a href="${ctaUrl}">Crear mi kit ahora →</a>
      </div>
      <p style="font-size: 13px; color: #888;">Al publicar y verificar tu kit, activas beneficios exclusivos en Rappi como mayor visibilidad y badges especiales.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Rappi · Todos los derechos reservados</p>
      <p>Este email fue enviado a ${restaurantName} por su participación en Rappi Social Launch.</p>
    </div>
  </div>
</body>
</html>`
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildKitReadyHtml(restaurantName: string, _kitId: string): string {
  const dashboardUrl = `${process.env.NEXTAUTH_URL}/dashboard`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #FF441B; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .body { padding: 32px 24px; }
    .body p { color: #555; line-height: 1.6; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a { background: #FF441B; color: white; padding: 16px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; }
    .footer { background: #1A1A1A; color: #aaa; padding: 16px 24px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>rappi</h1>
    </div>
    <div class="body">
      <h2 style="color:#1A1A1A;">¡Tu kit está listo, ${restaurantName}! 🎉</h2>
      <p>Hemos generado tus 3 piezas gráficas (Feed, Stories y WhatsApp) con IA. Ya puedes descargarlas y publicarlas.</p>
      <p>Recuerda: después de publicar, sube una captura de pantalla para verificar tu publicación y activar tus incentivos en Rappi.</p>
      <div class="cta">
        <a href="${dashboardUrl}">Ver y descargar mi kit →</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Rappi · Social Launch</p>
    </div>
  </div>
</body>
</html>`
}

export async function sendKitReminderEmail(restaurant: {
  id: string
  name: string
  email?: string | null
}): Promise<void> {
  if (!restaurant.email || !SENDGRID_CONFIGURED) return

  await sgMail.send({
    to: restaurant.email,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: `${restaurant.name}, ¿ya tienes tu kit de redes sociales de ${new Date().toLocaleDateString('es-CO', { month: 'long' })}?`,
    html: buildReminderHtml(restaurant.name, restaurant.id),
  })
}

export async function sendKitReadyEmail(
  restaurant: { name: string; email?: string | null },
  kitId: string // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<void> {
  if (!restaurant.email || !SENDGRID_CONFIGURED) return

  await sgMail.send({
    to: restaurant.email,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: `¡Tu kit de redes sociales está listo, ${restaurant.name}!`,
    html: buildKitReadyHtml(restaurant.name, ''),
  })
}
