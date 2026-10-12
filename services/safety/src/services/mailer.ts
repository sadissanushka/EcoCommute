export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class MailerService {
  private sentMails: EmailOptions[] = [];

  public async sendMail(options: EmailOptions): Promise<boolean> {
    this.sentMails.push(options);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MailerService] Sent email to: ${options.to} | Subject: ${options.subject}`);
    }
    return true;
  }

  public getSentMails(): EmailOptions[] {
    return this.sentMails;
  }

  public clearSentMails(): void {
    this.sentMails = [];
  }
}

export const mailerService = new MailerService();
