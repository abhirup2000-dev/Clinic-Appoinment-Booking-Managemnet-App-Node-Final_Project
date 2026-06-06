//OTP Verification Email

function otpEmailTemplate(name, otp) {
  const digits = otp.split("");
  const digitBoxes = digits
    .map(
      (d) =>
        `<span style="display:inline-block;width:48px;height:56px;line-height:56px;
         text-align:center;font-size:28px;font-weight:700;background:#f0f4ff;
         border:2px solid #6366f1;border-radius:10px;color:#4f46e5;margin:0 4px;">${d}</span>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Email Verification — CareConnect</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;
           box-shadow:0 4px 24px rgba(79,70,229,0.10);overflow:hidden;max-width:100%;">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
          🏥 CareConnect
        </h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your Trusted Healthcare Partner</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:40px;">
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">
          Verify Your Email Address 🔐
        </h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Hi <strong style="color:#1e293b;">${name}</strong>, welcome to CareConnect!<br>
          Please use the verification code below to activate your account.
          This code expires in <strong style="color:#ef4444;">5 minutes</strong>.
        </p>
        <!-- OTP Box -->
        <div style="text-align:center;background:#f8fafc;border-radius:12px;padding:28px 20px;margin:0 0 28px;">
          <p style="margin:0 0 16px;color:#64748b;font-size:13px;text-transform:uppercase;
                    letter-spacing:1px;font-weight:600;">Your Verification Code</p>
          <div style="letter-spacing:4px;">${digitBoxes}</div>
        </div>
        <!-- Warning -->
        <div style="background:#fff8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 20px;margin:0 0 28px;">
          <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
            ⚠️ <strong>Never share this code</strong> with anyone, including CareConnect staff.
            If you didn't create an account, please ignore this email.
          </p>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin:0;">
          This code will automatically expire in 5 minutes for your security.
        </p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">
          © 2026 CareConnect Systems. All rights reserved.<br>
          <a href="#" style="color:#6366f1;text-decoration:none;">Privacy Policy</a> ·
          <a href="#" style="color:#6366f1;text-decoration:none;">Terms of Service</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Welcome Email (post-verification)

function welcomeEmailTemplate(name, role) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Welcome — CareConnect</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(16,185,129,0.10);overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:36px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">🎉 Welcome to CareConnect!</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <p style="color:#1e293b;font-size:16px;line-height:1.7;">
          Hi <strong>${name}</strong>, your email has been successfully verified!<br><br>
          Your account is now active as a <strong style="color:#10b981;">${role}</strong>.
          You can now access all CareConnect features — book appointments, track your health,
          and connect with top doctors.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.APP_URL || "http://localhost:6001"}/patient/login-view"
             style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;
                    padding:14px 36px;border-radius:50px;text-decoration:none;
                    font-weight:700;font-size:15px;display:inline-block;">
            Go to My Dashboard →
          </a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 CareConnect Systems</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Doctor Credential Email

function doctorCredentialEmailTemplate(name, email, tempPassword, loginUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Doctor Login Credentials — CareConnect</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(79,70,229,0.10);overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">🩺 CareConnect Doctor Portal</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your account is ready</p>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Welcome, Dr. ${name}!</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Your doctor account has been created by the clinic administrator.
          Below are your login credentials. <strong style="color:#ef4444;">Please change your password
          immediately after your first login.</strong>
        </p>
        <!-- Credentials Box -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:28px;margin:0 0 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Email Address</span><br>
                <span style="color:#1e293b;font-size:16px;font-weight:600;margin-top:4px;display:block;">${email}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;">
                <span style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Temporary Password</span><br>
                <span style="color:#4f46e5;font-size:20px;font-weight:700;letter-spacing:2px;
                             background:#f0f4ff;border:2px dashed #6366f1;border-radius:8px;
                             padding:8px 16px;margin-top:8px;display:inline-block;
                             font-family:monospace;">${tempPassword}</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin:0 0 28px;">
          <a href="${loginUrl}"
             style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;
                    padding:14px 36px;border-radius:50px;text-decoration:none;
                    font-weight:700;font-size:15px;display:inline-block;">
            Login to Doctor Portal →
          </a>
        </div>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;">
          <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.5;">
            🔒 <strong>Security Notice:</strong> You will be required to change this password
            on your first login. Keep your credentials confidential.
          </p>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 CareConnect Systems. Confidential communication.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// 4. Appointment Confirmation Email

function appointmentConfirmEmailTemplate(
  patientName,
  doctorName,
  clinicName,
  department,
  date,
  slot,
  fee,
) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Appointment Confirmed — CareConnect</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(16,185,129,0.10);overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:36px 40px;text-align:center;">
        <div style="width:64px;height:64px;background:rgba(255,255,255,0.2);border-radius:50%;
                    margin:0 auto 16px;line-height:64px;font-size:32px;">✅</div>
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Appointment Confirmed!</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <p style="color:#1e293b;font-size:15px;margin:0 0 24px;">
          Hi <strong>${patientName}</strong>, your appointment has been booked and payment confirmed.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin:0 0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              ["👨‍⚕️ Doctor", `Dr. ${doctorName}`],
              ["🏥 Clinic", clinicName],
              ["🏷️ Department", department],
              ["📅 Date", date],
              ["⏰ Time Slot", slot],
              ["💳 Amount Paid", `₹${fee}`],
            ]
              .map(
                ([label, val]) =>
                  `<tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;">
                    <span style="color:#64748b;font-size:13px;">${label}</span><br>
                    <strong style="color:#1e293b;font-size:15px;">${val}</strong>
                  </td></tr>`,
              )
              .join("")}
          </table>
        </div>
        <p style="color:#64748b;font-size:13px;margin:0;">
          We'll notify you once the clinic confirms your slot. For any changes, visit your patient dashboard.
        </p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 CareConnect Systems</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Appointment Status Update Email
function appointmentStatusEmailTemplate(
  patientName,
  doctorName,
  clinicName,
  status,
) {
  const statusConfig = {
    confirmed: {
      color: "#10b981",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      icon: "✅",
      label: "Confirmed",
    },
    completed: {
      color: "#6366f1",
      bg: "#f0f4ff",
      border: "#c7d2fe",
      icon: "🎉",
      label: "Completed",
    },
    cancelled: {
      color: "#ef4444",
      bg: "#fef2f2",
      border: "#fecaca",
      icon: "❌",
      label: "Cancelled",
    },
  };
  const cfg = statusConfig[status] || statusConfig.confirmed;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Appointment ${cfg.label} — CareConnect</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
      <tr><td style="background:${cfg.color};padding:36px 40px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">${cfg.icon}</div>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">
          Appointment ${cfg.label}
        </h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:12px;padding:24px;">
          <p style="margin:0;color:#1e293b;font-size:15px;line-height:1.7;">
            Hi <strong>${patientName}</strong>, your appointment with
            <strong>Dr. ${doctorName}</strong> at <strong>${clinicName}</strong>
            has been marked as <strong style="color:${cfg.color};">${cfg.label}</strong>.
          </p>
        </div>
        <p style="margin:24px 0 0;color:#64748b;font-size:13px;">
          For any support or rescheduling, please access your patient dashboard.
        </p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 CareConnect Systems</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

module.exports = {
  otpEmailTemplate,
  welcomeEmailTemplate,
  doctorCredentialEmailTemplate,
  appointmentConfirmEmailTemplate,
  appointmentStatusEmailTemplate,
};
