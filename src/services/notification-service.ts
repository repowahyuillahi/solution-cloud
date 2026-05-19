/**
 * Notification Delivery Service
 *
 * Handles sending attendance reports via multiple channels:
 * - WhatsApp (via external API)
 * - Email (via SMTP)
 * - Telegram (via Bot API)
 *
 * Each channel can be independently enabled/disabled per tenant.
 *
 * @see Requirements 17.1-17.8
 */

import axios from 'axios';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface WhatsAppConfig {
  apiUrl: string;
  apiKey: string;
  recipients: string[];
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  recipients: string[];
}

export interface TelegramConfig {
  botToken: string;
  chatIds: string[];
}

export interface DeliveryResult {
  channel: 'whatsapp' | 'email' | 'telegram';
  success: boolean;
  recipientCount: number;
  error?: string;
}

// ============================================================================
// WhatsApp
// ============================================================================

/**
 * Send a file via WhatsApp API.
 *
 * @param recipients - Array of phone numbers
 * @param fileBuffer - The file content as a Buffer
 * @param fileName - Name of the file
 * @param config - WhatsApp API configuration
 */
export async function sendWhatsApp(
  recipients: string[],
  fileBuffer: Buffer,
  fileName: string,
  config: WhatsAppConfig,
): Promise<DeliveryResult> {
  try {
    for (const recipient of recipients) {
      await axios.post(
        config.apiUrl,
        {
          phone: recipient,
          document: fileBuffer.toString('base64'),
          fileName,
          caption: `Laporan Absensi - ${fileName}`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          timeout: 30_000,
        },
      );
    }

    return {
      channel: 'whatsapp',
      success: true,
      recipientCount: recipients.length,
    };
  } catch (error) {
    return {
      channel: 'whatsapp',
      success: false,
      recipientCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Email
// ============================================================================

/**
 * Send a file via Email (SMTP).
 *
 * Note: In production, use nodemailer or similar library.
 * This is a placeholder implementation for the MVP.
 *
 * @param recipients - Array of email addresses
 * @param fileBuffer - The file content as a Buffer
 * @param fileName - Name of the file
 * @param config - SMTP configuration
 */
export async function sendEmail(
  recipients: string[],
  fileBuffer: Buffer,
  fileName: string,
  config: EmailConfig,
): Promise<DeliveryResult> {
  try {
    // Placeholder: In production, use nodemailer
    // const transporter = nodemailer.createTransport({
    //   host: config.smtpHost,
    //   port: config.smtpPort,
    //   auth: { user: config.smtpUser, pass: config.smtpPass },
    // });
    //
    // await transporter.sendMail({
    //   from: config.smtpUser,
    //   to: recipients.join(','),
    //   subject: `Laporan Absensi - ${fileName}`,
    //   text: 'Terlampir laporan absensi harian.',
    //   attachments: [{ filename: fileName, content: fileBuffer }],
    // });

    logger.info(`[Email] Would send "${fileName}" to ${recipients.length} recipients via ${config.smtpHost}`);

    return {
      channel: 'email',
      success: true,
      recipientCount: recipients.length,
    };
  } catch (error) {
    return {
      channel: 'email',
      success: false,
      recipientCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Telegram
// ============================================================================

/**
 * Send a file via Telegram Bot API.
 *
 * @param chatIds - Array of Telegram chat IDs
 * @param fileBuffer - The file content as a Buffer
 * @param fileName - Name of the file
 * @param config - Telegram bot configuration
 */
export async function sendTelegram(
  chatIds: string[],
  fileBuffer: Buffer,
  fileName: string,
  config: TelegramConfig,
): Promise<DeliveryResult> {
  try {
    const telegramApiUrl = `https://api.telegram.org/bot${config.botToken}/sendDocument`;

    for (const chatId of chatIds) {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', new Blob([new Uint8Array(fileBuffer)]), fileName);
      formData.append('caption', `📋 Laporan Absensi - ${fileName}`);

      await axios.post(telegramApiUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      });
    }

    return {
      channel: 'telegram',
      success: true,
      recipientCount: chatIds.length,
    };
  } catch (error) {
    return {
      channel: 'telegram',
      success: false,
      recipientCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
