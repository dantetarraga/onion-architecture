import nodemailer, { Transporter } from 'nodemailer';
import { config } from './config';
import { ReservationConfirmationEvent } from './types';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      // Puerto 465 = SMTPS (TLS implicito desde el connect). Cualquier otro
      // puerto (ej. 587) usa STARTTLS, que nodemailer negocia solo.
      secure: config.mail.port === 465,
      auth: {
        user: config.mail.username,
        pass: config.mail.password,
      },
    });
  }
  return transporter;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function buildEmail(event: ReservationConfirmationEvent) {
  const subject = `Reserva confirmada en ${event.branchName}`;
  const startAt = formatDate(event.startAt);
  const expiresAt = formatDate(event.expiresAt);

  const text = [
    `Hola ${event.userFullName},`,
    '',
    `Tu reserva de cochera quedo confirmada.`,
    '',
    `Sucursal: ${event.branchName} (${event.branchAddress})`,
    `Espacio: ${event.slotId}`,
    `Hora de inicio: ${startAt}`,
    `Valida hasta: ${expiresAt}`,
    `Codigo de reserva: ${event.reservationId}`,
    '',
    'Si no reconoces esta reserva, contacta a soporte.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px;">
      <h2 style="margin-bottom: 0;">Reserva confirmada</h2>
      <p>Hola <strong>${event.userFullName}</strong>,</p>
      <p>Tu reserva de cochera quedo confirmada. Estos son los detalles:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 4px 8px; color:#555;">Sucursal</td><td style="padding: 4px 8px;"><strong>${event.branchName}</strong></td></tr>
        <tr><td style="padding: 4px 8px; color:#555;">Direccion</td><td style="padding: 4px 8px;">${event.branchAddress}</td></tr>
        <tr><td style="padding: 4px 8px; color:#555;">Espacio</td><td style="padding: 4px 8px;">${event.slotId}</td></tr>
        <tr><td style="padding: 4px 8px; color:#555;">Hora de inicio</td><td style="padding: 4px 8px;">${startAt}</td></tr>
        <tr><td style="padding: 4px 8px; color:#555;">Valida hasta</td><td style="padding: 4px 8px;">${expiresAt}</td></tr>
        <tr><td style="padding: 4px 8px; color:#555;">Codigo de reserva</td><td style="padding: 4px 8px;"><code>${event.reservationId}</code></td></tr>
      </table>
      <p style="color:#777; font-size: 12px; margin-top: 24px;">Si no reconoces esta reserva, contacta a soporte.</p>
    </div>
  `;

  return { subject, text, html };
}

/**
 * Envia el correo de confirmacion. Con `MAIL_ENABLED=false` solo loguea lo
 * que hubiera enviado (dry-run), sin tocar la red - mismo criterio de
 * resiliencia deliberada que usa el productor en el backend: este servicio
 * nunca debe reventar el proceso del consumidor por un problema de correo.
 */
export async function sendConfirmationEmail(
  event: ReservationConfirmationEvent,
): Promise<void> {
  const { subject, text, html } = buildEmail(event);

  if (!config.mail.enabled) {
    console.log(
      `[mailer] MAIL_ENABLED=false, no se envia correo real. Hubiera enviado "${subject}" a ${event.userEmail} (reserva ${event.reservationId})`,
    );
    return;
  }

  await getTransporter().sendMail({
    from: config.mail.fromEmail,
    to: event.userEmail,
    subject,
    text,
    html,
  });
}
