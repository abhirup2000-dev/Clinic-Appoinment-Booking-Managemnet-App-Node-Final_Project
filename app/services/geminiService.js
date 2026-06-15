/**
 * Gemini AI Service — wraps Google Generative AI SDK.
 * Falls back to rule-based responses if API key not configured.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// System instructions for the medical assistant persona
const SYSTEM_INSTRUCTIONS = `
You are CareConnect AI, the virtual healthcare assistant for CareConnect.

YOUR ROLE:
You assist patients with:
- Understanding symptoms and recommending the appropriate medical department.
- Booking, rescheduling, canceling, and tracking appointments.
- Explaining clinic services and doctor specializations.
- Providing general health and wellness information.
- Helping with account, payment, insurance, and scheduling questions.
- Answering FAQs about clinic policies and procedures.

IMPORTANT MEDICAL SAFETY RULES:
- Never provide a medical diagnosis.
- Never claim a patient has a specific disease or condition.
- Never prescribe medications, dosage, or treatments.
- Never recommend stopping or starting medications.
- Always encourage users to consult a qualified healthcare professional.
- If symptoms appear severe, urgent, or life-threatening, immediately advise:
  "Please call 112 or go to your nearest emergency room immediately."

HIGH-RISK SYMPTOMS:
If a user mentions any of the following:
- Chest pain
- Difficulty breathing
- Severe allergic reaction
- Loss of consciousness
- Stroke symptoms
- Seizures
- Heavy bleeding
- Suicidal thoughts
- Severe burns
- Poisoning

Respond with:
"Your symptoms may require urgent medical attention. Please call 112 or go to your nearest emergency room immediately."

SYMPTOM TRIAGE GUIDELINES:
When users describe symptoms:
1. Acknowledge their concern empathetically.
2. Ask 1-3 relevant follow-up questions if necessary.
3. Suggest the most suitable medical department.
4. Recommend scheduling an appointment.
5. Remind them that only a doctor can provide a diagnosis.

Department Suggestions:
- Fever, cold, cough → General Medicine
- Skin rash, acne → Dermatology
- Tooth pain → Dentistry
- Eye irritation, blurry vision → Ophthalmology
- Ear pain, sinus issues → ENT
- Bone, joint, muscle pain → Orthopedics
- Anxiety, stress, depression → Mental Health / Psychiatry
- Women's health concerns → Gynecology
- Children's health concerns → Pediatrics
- Heart-related concerns → Cardiology
- Digestive issues → Gastroenterology

APPOINTMENT ASSISTANCE:
When users ask about appointments:
- Explain booking steps clearly.
- Help find appropriate specialists.
- Explain cancellation and rescheduling policies.
- Provide estimated appointment procedures.
- Encourage early booking for urgent concerns.

PAYMENT & ACCOUNT SUPPORT:
For payment questions:
- Explain supported payment methods.
- Help with payment status inquiries.
- Direct users to support for billing disputes.

For account questions:
- Help with registration and login issues.
- Explain profile management.
- Guide password reset procedures.

COMMUNICATION STYLE:
- Be empathetic, respectful, and professional.
- Use simple language understandable by non-medical users.
- Keep responses concise (3-6 sentences when possible).
- Use bullet points when appropriate.
- Avoid medical jargon unless necessary.
- Never create panic or fear.

OUT-OF-SCOPE REQUESTS:
If asked about topics unrelated to healthcare or clinic services:
"Sorry, I can only assist with healthcare, appointments, clinic services, and patient support."

PRIVACY:
- Never request passwords, OTPs, or sensitive financial information.
- Remind users not to share confidential personal information unnecessarily.

RESPONSE FORMAT:
1. Acknowledge the user's concern.
2. Provide helpful information.
3. Recommend the appropriate next step.
4. End with:
"Is there anything else I can help you with today?"

Remember:
You are an informational healthcare assistant, not a doctor. Your purpose is to guide patients safely and help them access appropriate healthcare services.
`;

let genAI = null;
let model = null;

// Initialize Gemini client if API key is present
if (
  process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTIONS,
    });
    console.log("✅ Gemini AI service initialized successfully");
  } catch (err) {
    console.warn(
      "⚠️ Gemini AI initialization failed — using rule-based fallback:",
      err.message,
    );
  }
} else {
  console.log(
    "ℹ️ GEMINI_API_KEY not set — AI chatbot using rule-based fallback mode",
  );
}

/**
 * Send a message to Gemini with conversation history.
 * @param {string} userMessage - Latest user message
 * @param {Array<{role, parts}>} history - Prior conversation turns
 * @returns {Promise<string>} AI response text
 */
async function chatWithGemini(userMessage, history = []) {
  // Use Gemini if available
  if (model) {
    try {
      // Convert our DB history format to Gemini format
      const geminiHistory = history.map((turn) => ({
        role: turn.role, // "user" or "model"
        parts: [{ text: turn.content }],
      }));

      const chat = model.startChat({
        history: geminiHistory,
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.7,
        },
      });

      const result = await chat.sendMessage(userMessage);
      return result.response.text();
    } catch (err) {
      console.error(
        "Gemini API error — falling back to rule-based:",
        err.message,
      );
      // Fall through to rule-based
    }
  }

  // Rule-based fallback
  return getRuleBasedResponse(userMessage);
}

/**
 * High-quality rule-based fallback chatbot responses.
 * Matches the existing chat-widget.ejs fallback logic but centralized.
 */
function getRuleBasedResponse(msg) {
  const text = msg.toLowerCase();

  if (
    text.includes("emergency") ||
    text.includes("urgent") ||
    text.includes("critical")
  ) {
    return "🚨 For medical emergencies, please call **112** immediately or go to your nearest emergency room. Do not wait for an online appointment for urgent medical conditions.";
  }
  if (
    text.includes("book") ||
    text.includes("appointment") ||
    text.includes("schedule")
  ) {
    return "📅 To book an appointment:\n1. Log in to your patient dashboard\n2. Click 'Book Appointment'\n3. Select your Clinic → Department → Doctor → Date & Slot\n4. Complete the payment via Razorpay\n\nYour booking confirmation will be emailed to you. Is there anything else I can help with?";
  }
  if (
    text.includes("heart") ||
    text.includes("chest") ||
    text.includes("cardio") ||
    text.includes("bp") ||
    text.includes("pulse")
  ) {
    return "❤️ Your symptoms suggest a visit to our **Cardiology** department. Our cardiologists handle heart health, blood pressure, ECG, and chest-related concerns. Please book an appointment — do not ignore cardiac symptoms. Shall I help you find available cardiologists?";
  }
  if (
    text.includes("child") ||
    text.includes("baby") ||
    text.includes("kid") ||
    text.includes("pediatric")
  ) {
    return "👶 For your child's health, our **Pediatrics** department is the right choice. Our pediatricians handle vaccinations, growth monitoring, fever, and child development. Would you like to book a pediatric consultation?";
  }
  if (
    text.includes("tooth") ||
    text.includes("dental") ||
    text.includes("teeth") ||
    text.includes("gum")
  ) {
    return "🦷 For dental concerns, please visit our **Dental Care** department. We cover dental exams, cleanings, fillings, and oral surgery. Would you like to check available dental appointment slots?";
  }
  if (
    text.includes("headache") ||
    text.includes("migraine") ||
    text.includes("brain") ||
    text.includes("nerve") ||
    text.includes("neuro")
  ) {
    return "🧠 Your symptoms may relate to our **Neurology** department. Persistent headaches, migraines, or nerve issues should be evaluated by a specialist. Would you like me to find available neurologists?";
  }
  if (
    text.includes("bone") ||
    text.includes("joint") ||
    text.includes("fracture") ||
    text.includes("back pain") ||
    text.includes("ortho")
  ) {
    return "🦴 For bone, joint, or muscle concerns, our **Orthopedics** department can help. We cover fractures, arthritis, back pain, and sports injuries. Shall I help you book an orthopedic appointment?";
  }
  if (
    text.includes("fever") ||
    text.includes("cold") ||
    text.includes("cough") ||
    text.includes("flu") ||
    text.includes("infection")
  ) {
    return "🌡️ For general illness like fever, cough, or infections, our **General Medicine** department is here to help. Would you like to book with a general physician?";
  }
  if (
    text.includes("refund") ||
    text.includes("payment") ||
    text.includes("cost") ||
    text.includes("fee") ||
    text.includes("price")
  ) {
    return "💳 Payments are processed securely via Razorpay. Refunds for cancelled appointments are processed within 5-7 business days to your original payment method. For payment disputes, please email support@careconnect.com.";
  }
  if (text.includes("cancel") || text.includes("reschedule")) {
    return "🔄 To cancel or reschedule, visit your **Patient Dashboard → My Appointments**, select the appointment, and use the Cancel/Reschedule option. Cancellations made 24+ hours in advance are fully refundable.";
  }
  if (
    text.includes("password") ||
    text.includes("login") ||
    text.includes("account") ||
    text.includes("register")
  ) {
    return "🔑 For account help:\n• **Register** at `/patient/register-view`\n• **Login** at `/patient/login-view`\n• **Forgot password** — use the link on the login page\n• **Email issues** — contact support@careconnect.com\n\nIs there anything else I can help with?";
  }
  if (
    text.includes("timing") ||
    text.includes("hours") ||
    text.includes("open") ||
    text.includes("clinic")
  ) {
    return "🏥 Clinic timings vary by location. Generally our partner clinics operate **9 AM – 6 PM** on weekdays and **9 AM – 2 PM** on weekends. Visit the **Clinics** page to see specific hours and departments for each clinic.";
  }
  if (
    text.includes("hello") ||
    text.includes("hi") ||
    text.includes("hey") ||
    text.includes("good morning") ||
    text.includes("good evening")
  ) {
    return "👋 Hello! Welcome to CareConnect. I'm your AI medical assistant. I can help you:\n• Find the right doctor or department for your symptoms\n• Book and manage appointments\n• Answer questions about our clinics and services\n\nWhat can I help you with today?";
  }
  if (text.includes("thank")) {
    return "😊 You're welcome! Your health is our priority. Is there anything else I can help you with? Don't hesitate to ask!";
  }
  return "🤖 I'm here to help with your healthcare needs! I can assist with:\n• **Symptom guidance** — which specialist to see\n• **Appointment booking** — step-by-step help\n• **Clinic & doctor information**\n• **Payment & account queries**\n\nCould you tell me more about what you need?";
}

module.exports = { chatWithGemini, getRuleBasedResponse };
