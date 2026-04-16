import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

class EmailClient:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")

    def send_otp(self, to_email: str, otp: str):
        """Sends an OTP to the user's email."""
        
        # LOGGING TO CONSOLE FOR EASY TESTING
        print(f"DEBUG: SENT OTP '{otp}' TO EMAIL '{to_email}'")
        
        if not self.smtp_user or not self.smtp_password:
            print("WARNING: SMTP credentials not configured. Email not sent, but see DEBUG message above.")
            return True

        try:
            msg = MIMEMultipart()
            msg['From'] = self.smtp_user
            msg['To'] = to_email
            msg['Subject'] = "Your Shiro.ai Login Code"

            body = f"""
            <html>
            <body>
              <h2>Hello!</h2>
              <p>Your one-time login code for Shiro.ai is:</p>
              <h1 style="color: #daae51; letter-spacing: 5px;">{otp}</h1>
              <p>This code will expire in 5 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </body>
            </html>
            """
            msg.attach(MIMEText(body, 'html'))

            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
            server.quit()
            return True
        except Exception as e:
            print(f"CRITICAL: Failed to send email: {e}")
            return False

email_client = EmailClient()
