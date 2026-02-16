import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, imageBase64, userName } = req.body;

    if (!to || !imageBase64) {
      return res.status(400).json({ error: 'Faltan campos requeridos (to, imageBase64)' });
    }

    // Configurar transporter con Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Preparar el email
    const mailOptions = {
      from: `"Test Oposiciones" <${process.env.SMTP_USER}>`,
      to: to,
      subject: '🛑 Tu Análisis de Fallos - Test de Oposiciones',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #9B7653; text-align: center;">📊 Análisis de Fallos</h1>
          <p style="color: #333; font-size: 16px;">
            Hola${userName ? ` ${userName}` : ''},
          </p>
          <p style="color: #333; font-size: 16px;">
            Aquí tienes tu infografía personalizada con el análisis de los errores de tu último test.
            Úsala para repasar los puntos donde fallaste y mejorar en tu próximo intento.
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            ¡Mucho ánimo con tu preparación! 💪
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Este email fue enviado desde Test de Oposiciones de Justicia
          </p>
        </div>
      `,
      attachments: [
        {
          filename: 'analisis-fallos.png',
          content: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          encoding: 'base64',
          cid: 'infografia',
        },
      ],
    };

    // Enviar el email
    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: 'Email enviado correctamente' });
  } catch (error) {
    console.error('Error enviando email:', error);
    return res.status(500).json({ error: 'Error al enviar el email', details: error.message });
  }
}
